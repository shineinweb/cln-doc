import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { encryptString } from '../src/crypto'
import { prisma } from '../src/db'
import { FakeMetaClient, RealMetaClient } from '../src/providers/meta'
import { RealNetworkGateway } from '../src/providers/networks'
import { createPost, register, testApp, uploadPng } from './helpers'

describe('smart links, stories, and stored reports', () => {
  it('counts each public smart-link redirect and keeps the stored address', async () => {
    const { app } = testApp()
    const owner = await register(app)
    const created = await owner.api.post('/api/posts', {
      format: 'photo',
      description: 'A cup of coffee on the counter',
      smartLinkUrl: 'https://brand.example/spring',
    })
    expect(created.status).toBe(201)
    const code = created.body.post.smartLinkCode as string
    expect(created.body.post.smartLinkClicks).toBe(0)
    expect(created.body.post.smartLinkPath).toBe(`/api/l/${code}`)

    const first = await request(app).get(`/api/l/${code}`).redirects(0)
    expect(first.status).toBe(302)
    expect(first.headers.location).toBe('https://brand.example/spring')
    expect(first.headers['cache-control']).toBe('no-store')

    const second = await request(app).get(`/api/l/${code}`).query({ url: 'https://evil.example' }).redirects(0)
    expect(second.status).toBe(302)
    expect(second.headers.location).toBe('https://brand.example/spring')

    const stored = await prisma.post.findUnique({ where: { id: created.body.post.id as string } })
    expect(stored?.smartLinkClicks).toBe(2)
    const listed = await owner.api.get(`/api/posts/${created.body.post.id}`)
    expect(listed.body.post.smartLinkClicks).toBe(2)

    const missing = await request(app).get('/api/l/missing-code').redirects(0)
    expect(missing.status).toBe(404)
    expect((await prisma.post.findUnique({ where: { id: created.body.post.id as string } }))?.smartLinkClicks).toBe(2)

    const rejected = await owner.api.post('/api/posts', { smartLinkUrl: 'javascript:alert(1)' })
    expect(rejected.status).toBe(400)
  })

  it('records a story target the network cannot publish and does not call that network', async () => {
    const { app, deps, networks } = testApp()
    const owner = await register(app)
    const tiktok = await connectedAccount(deps, owner.orgId, 'tiktok', 'clip')
    const youtube = await connectedAccount(deps, owner.orgId, 'youtube', 'channel')
    const post = await createPost(owner, {
      format: 'story',
      socialAccountIds: [tiktok.id, youtube.id],
    })
    expect((await uploadPng(owner, post.id)).status).toBe(201)
    expect((await owner.api.post(`/api/posts/${post.id}/approve`)).status).toBe(200)
    const published = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(published.status).toBe(409)
    expect(networks.calls.filter((call) => call.method === 'publish' || call.method === 'firstComment')).toEqual([])
    const targets = published.body.post.targets as Array<{ network: string; status: string; error: string | null }>
    expect(targets.find((target) => target.network === 'tiktok')).toMatchObject({
      status: 'FAILED',
      error: 'TikTok cannot publish a story',
    })
    expect(targets.find((target) => target.network === 'youtube')).toMatchObject({
      status: 'FAILED',
      error: 'YouTube cannot publish a story',
    })
  })

  it('publishes a story only through the official story endpoints', async () => {
    const urls: string[] = []
    const bodies: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      urls.push(`${init?.method ?? 'GET'} ${url}`)
      if (init?.body) bodies.push(String(init.body))
      if (url.endsWith('/page1/photos')) return json({ id: 'photo-1' })
      if (url.endsWith('/page1/photo_stories')) return json({ post_id: 'story-1' })
      if (url.includes('/ig-user/media')) return json({ id: 'ig-container' })
      throw new Error(`unexpected ${url}`)
    }
    const meta = new RealMetaClient({} as never, fetchImpl)
    await meta.createMediaContainer({
      igUserId: 'ig-user',
      accessToken: 'ig-token',
      format: 'story',
      caption: 'Should stay off the story',
      mediaUrls: ['https://media.example/a.png'],
    })
    expect(bodies.some((body) => body.includes('media_type=STORIES') && body.includes('image_url='))).toBe(true)
    expect(bodies.some((body) => body.includes('caption='))).toBe(false)

    const gateway = new RealNetworkGateway(new FakeMetaClient('secret'), fetchImpl)
    const facebook = await gateway.publish({
      network: 'facebook',
      format: 'story',
      caption: 'Story',
      mediaUrls: ['https://media.example/a.png'],
      accessToken: 'page-token',
      externalId: 'page1',
    })
    expect(facebook.remoteId).toBe('story-1')
    expect(urls.some((url) => url.includes('/page1/photo_stories'))).toBe(true)
    expect(urls.some((url) => url.includes('/page1/feed'))).toBe(false)
    await expect(gateway.publish({
      network: 'tiktok',
      format: 'story',
      caption: 'Story',
      mediaUrls: ['https://media.example/a.png'],
      accessToken: 'tt-token',
      externalId: 'open',
    })).rejects.toThrow('TikTok cannot publish a story')
    await expect(gateway.publish({
      network: 'youtube',
      format: 'story',
      caption: 'Story',
      mediaUrls: ['https://media.example/clip.mp4'],
      accessToken: 'yt-token',
      externalId: 'channel',
    })).rejects.toThrow('YouTube cannot publish a story')
    expect(urls.some((url) => url.includes('tiktok') || url.includes('youtube') || url.includes('googleapis'))).toBe(false)
  })

  it('reports only official metrics already stored in the date range', async () => {
    const { app, meta } = testApp()
    const owner = await register(app)
    await prisma.metricSnapshot.create({
      data: {
        organizationId: owner.orgId,
        metric: 'insights',
        value: 120,
        capturedAt: new Date('2026-04-02T12:00:00.000Z'),
        dimensions: {
          followers: [{ date: '2026-04-01', value: 120 }],
          byFormat: { photo: { posts: 1, saves: 5, reach: 90, comments: 1 } },
        },
      },
    })
    await prisma.metricSnapshot.create({
      data: {
        organizationId: owner.orgId,
        metric: 'insights',
        value: 4,
        capturedAt: new Date('2026-01-02T12:00:00.000Z'),
        dimensions: { followers: [{ date: '2026-01-01', value: 4 }] },
      },
    })
    const report = await owner.api.get('/api/reports?from=2026-04-01&to=2026-04-30')
    expect(report.status).toBe(200)
    expect(report.body.rows).toHaveLength(1)
    expect(report.body.rows[0].value).toBe(120)
    expect(report.body.rows[0].dimensions.followers).toEqual([{ date: '2026-04-01', value: 120 }])
    expect(meta.calls.filter((call) => call.method === 'getInsights')).toEqual([])
    const empty = await owner.api.get('/api/reports?from=2026-05-01&to=2026-05-02')
    expect(empty.status).toBe(200)
    expect(empty.body.rows).toEqual([])
  })
})

async function connectedAccount(
  deps: { env: { TOKEN_ENCRYPTION_KEY: string } },
  organizationId: string,
  network: string,
  name: string,
) {
  return prisma.socialAccount.create({
    data: {
      organizationId,
      network,
      externalId: `${network}-${name}`,
      displayName: name,
      username: name,
      status: 'connected',
      scopes: 'publish',
      credential: {
        create: {
          organizationId,
          accessTokenEnc: encryptString(`token-${network}-${name}`, deps.env.TOKEN_ENCRYPTION_KEY),
        },
      },
    },
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}
