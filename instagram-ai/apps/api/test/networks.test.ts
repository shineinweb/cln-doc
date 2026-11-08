import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { encryptString } from '../src/crypto'
import { prisma } from '../src/db'
import { FakeMetaClient } from '../src/providers/meta'
import { RealNetworkGateway } from '../src/providers/networks'
import { createPost, publishDue, register, staffLogin, testApp, upgrade, uploadPng } from './helpers'

describe('multi-network publishing and Google login', () => {
  it('publishes each selected adapter once after approval and does not comment early', async () => {
    const { app, deps, networks } = testApp()
    const owner = await register(app)
    const instagram = await connectedAccount(deps, owner.orgId, 'instagram', 'cafe')
    const facebook = await connectedAccount(deps, owner.orgId, 'facebook', 'page')
    const youtube = await connectedAccount(deps, owner.orgId, 'youtube', 'channel')
    const post = await createPost(owner, {
      format: 'photo',
      socialAccountIds: [instagram.id, facebook.id, youtube.id],
      firstComment: 'Thanks for watching',
    })
    expect((await uploadPng(owner, post.id)).status).toBe(201)
    const moved = await owner.api.post(`/api/posts/${post.id}/move`, { scheduledAt: '2026-12-01T12:00:00.000Z' })
    expect(moved.status).toBe(200)
    expect(moved.body.post.status).toBe('DRAFT')
    expect(new Date(moved.body.post.scheduledAt).toISOString()).toBe('2026-12-01T12:00:00.000Z')
    expect(networks.calls.filter((call) => call.method === 'publish')).toEqual([])
    const early = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('approval_required')
    expect(networks.calls.filter((call) => call.method === 'publish' || call.method === 'firstComment')).toEqual([])

    await owner.api.post(`/api/posts/${post.id}/approve`)
    const published = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(published.status).toBe(200)
    expect(published.body.post.status).toBe('PUBLISHED')
    const publishes = networks.calls.filter((call) => call.method === 'publish')
    expect(publishes.map((call) => call.network).sort()).toEqual(['facebook', 'instagram'])
    expect(publishes.filter((call) => call.network === 'instagram')).toHaveLength(1)
    expect(publishes.filter((call) => call.network === 'facebook')).toHaveLength(1)
    expect(publishes.some((call) => call.network === 'youtube')).toBe(false)
    const comments = networks.calls.filter((call) => call.method === 'firstComment')
    expect(comments.map((call) => call.network).sort()).toEqual(['facebook', 'instagram'])
    expect(comments.every((call) => call.text === 'Thanks for watching')).toBe(true)
    for (const network of ['instagram', 'facebook']) {
      expect(networks.calls.findIndex((call) => call.method === 'publish' && call.network === network)).toBeLessThan(
        networks.calls.findIndex((call) => call.method === 'firstComment' && call.network === network),
      )
    }
    const youtubeTarget = published.body.post.targets.find((target: { network: string }) => target.network === 'youtube')
    expect(youtubeTarget.status).toBe('FAILED')
    expect(youtubeTarget.error).toMatch(/does not accept a photo/)
    expect(youtubeTarget.firstCommentAvailable).toBe(false)
    expect(youtubeTarget.firstCommentError).toBe('A first comment is not available on YouTube')
    const facebookTarget = published.body.post.targets.find((target: { network: string }) => target.network === 'facebook')
    expect(facebookTarget.status).toBe('PUBLISHED')
    expect(facebookTarget.error).toBeNull()
  })

  it('schedules one post and the sweep publishes every target once', async () => {
    const { app, deps, networks } = testApp()
    const owner = await register(app, 'Sweep Co')
    await upgrade(owner, 'growth')
    const tiktok = await connectedAccount(deps, owner.orgId, 'tiktok', 'clip')
    const youtube = await connectedAccount(deps, owner.orgId, 'youtube', 'wide')
    const post = await createPost(owner, {
      format: 'video',
      durationSeconds: 15,
      socialAccountIds: [tiktok.id, youtube.id],
      firstComment: 'Pinned',
    })
    await uploadPng(owner, post.id)
    await owner.api.post(`/api/posts/${post.id}/approve`)
    const scheduled = await owner.api.post(`/api/posts/${post.id}/schedule`, {
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(scheduled.status).toBe(200)
    networks.calls.length = 0
    await publishDue(deps)
    const publishes = networks.calls.filter((call) => call.method === 'publish')
    expect(publishes.map((call) => call.network).sort()).toEqual(['tiktok', 'youtube'])
    expect(networks.calls.some((call) => call.method === 'firstComment')).toBe(false)
    const stored = await prisma.post.findUnique({ where: { id: post.id }, include: { targets: { include: { account: true } } } })
    expect(stored?.status).toBe('PUBLISHED')
    for (const target of stored?.targets ?? []) {
      expect(target.status).toBe('PUBLISHED')
      expect(target.firstCommentError).toMatch(/not available/)
      expect(target.firstCommentRemoteId).toBeNull()
    }
  })

  it('calls the official Facebook, TikTok, and YouTube endpoints from the real adapter', async () => {
    const urls: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      urls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url.endsWith('/page1/feed')) return json({ id: 'fb-post' })
      if (url.endsWith('/page1/videos')) return json({ id: 'fb-video' })
      if (url.endsWith('/fb-post/comments')) return json({ id: 'fb-comment' })
      if (url === 'https://open.tiktokapis.com/v2/post/publish/video/init/') return json({ data: { publish_id: 'tt-1' }, error: { code: 'ok' } })
      if (url === 'https://media.example/wide.mp4') return new Response(Buffer.from('mp4-bytes'), { status: 200 })
      if (url.startsWith('https://www.googleapis.com/upload/youtube/v3/videos')) {
        return new Response('{}', { status: 200, headers: { location: 'https://upload.example/yt' } })
      }
      if (url === 'https://upload.example/yt') return json({ id: 'yt-1' })
      throw new Error(`unexpected ${url}`)
    }
    const meta = new FakeMetaClient('secret')
    const gateway = new RealNetworkGateway(meta, fetchImpl)
    const photo = await gateway.publish({
      network: 'facebook',
      format: 'photo',
      caption: 'Hello',
      mediaUrls: ['https://media.example/a.png'],
      accessToken: 'page-token',
      externalId: 'page1',
    })
    expect(photo.remoteId).toBe('fb-post')
    const video = await gateway.publish({
      network: 'facebook',
      format: 'video',
      caption: 'Clip',
      mediaUrls: ['https://media.example/wide.mp4'],
      accessToken: 'page-token',
      externalId: 'page1',
    })
    expect(video.remoteId).toBe('fb-video')
    const comment = await gateway.firstComment({
      network: 'facebook',
      accessToken: 'page-token',
      remoteId: 'fb-post',
      externalId: 'page1',
      text: 'First',
    })
    expect(comment.id).toBe('fb-comment')
    const tiktok = await gateway.publish({
      network: 'tiktok',
      format: 'reel',
      caption: 'Vertical',
      mediaUrls: ['https://media.example/wide.mp4'],
      accessToken: 'tt-token',
      externalId: 'open',
    })
    expect(tiktok.remoteId).toBe('tt-1')
    const youtube = await gateway.publish({
      network: 'youtube',
      format: 'video',
      caption: 'Wide',
      mediaUrls: ['https://media.example/wide.mp4'],
      accessToken: 'yt-token',
      externalId: 'channel',
    })
    expect(youtube.remoteId).toBe('yt-1')
    const instagram = await gateway.publish({
      network: 'instagram',
      format: 'photo',
      caption: 'Graph',
      mediaUrls: ['https://media.example/a.png'],
      accessToken: 'ig-token',
      externalId: 'ig-user',
    })
    expect(instagram.remoteId).toMatch(/^media_/)
    expect(meta.calls.filter((call) => call.method === 'publishContainer')).toHaveLength(1)
    expect(urls.some((url) => url.includes('/page1/feed'))).toBe(true)
    expect(urls.some((url) => url.includes('/page1/videos'))).toBe(true)
    expect(urls.some((url) => url.includes('open.tiktokapis.com/v2/post/publish/video/init'))).toBe(true)
    expect(urls.some((url) => url.includes('/youtube/v3/videos') && url.includes('uploadType=resumable'))).toBe(true)
    expect(urls.some((url) => url.includes('api.openai.com'))).toBe(false)
    const tiktokUrl = gateway.buildAuthorizeUrl({
      network: 'tiktok',
      app: { clientId: 'client-key', clientSecret: 'super-secret' },
      redirectUri: 'https://app.example/cb',
      state: 'state-1',
    })
    expect(tiktokUrl.startsWith('https://www.tiktok.com/v2/auth/authorize/')).toBe(true)
    expect(tiktokUrl).not.toContain('super-secret')
  })

  it('signs customers in with a mocked Google token and keeps email login for staff', async () => {
    const { app, google } = testApp()
    const staff = await staffLogin(app)
    const saved = await staff.api.put('/api/admin/oauth-apps', {
      google: { clientId: 'google-client-id', clientSecret: 'google-secret-value' },
      facebook: { clientId: 'fb-client-id', clientSecret: 'fb-secret-value' },
    })
    expect(saved.status).toBe(200)
    expect(saved.body.google).toEqual({ clientIdSet: true, clientSecretSet: true })
    expect(JSON.stringify(saved.body)).not.toContain('google-secret-value')
    expect(JSON.stringify(saved.body)).not.toContain('google-client-id')
    expect(JSON.stringify(saved.body)).not.toContain('fb-secret-value')
    const stored = await prisma.siteSetting.findUnique({ where: { key: 'secret.oauth.google.clientSecret' } })
    expect(JSON.stringify(stored?.value)).not.toContain('google-secret-value')

    const start = await request(app).get('/api/auth/google/start')
    expect(start.status).toBe(302)
    const location = String(start.headers.location)
    expect(location.startsWith('https://accounts.google.com/')).toBe(true)
    expect(location).not.toContain('google-secret-value')
    const state = new URL(location).searchParams.get('state')
    google.profile = { sub: 'sub-1', email: 'Ada.Google@example.com', name: 'Ada Google', emailVerified: true }
    const agent = request.agent(app)
    const callback = await agent.get('/api/auth/google/callback').query({ code: 'mock-code', state })
    expect(callback.status).toBe(302)
    expect(google.calls.some((call) => call.method === 'exchange')).toBe(true)
    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe('ada.google@example.com')
    const created = await prisma.user.findUnique({ where: { email: 'ada.google@example.com' } })
    expect(created?.passwordHash).toBeNull()
    expect(created?.googleSub).toBe('sub-1')
    expect(await prisma.membership.count({ where: { userId: created!.id } })).toBe(1)

    const owner = await register(app, 'Password Co')
    google.profile = { sub: 'sub-2', email: owner.email, name: 'Ada', emailVerified: true }
    const startAgain = await request(app).get('/api/auth/google/start')
    const stateAgain = new URL(String(startAgain.headers.location)).searchParams.get('state')
    const attached = await agent.get('/api/auth/google/callback').query({ code: 'mock-code-2', state: stateAgain })
    expect(attached.status).toBe(302)
    expect(await prisma.user.count({ where: { email: owner.email } })).toBe(1)
    expect((await prisma.user.findUnique({ where: { email: owner.email } }))?.googleSub).toBe('sub-2')
    expect((await prisma.user.findUnique({ where: { email: owner.email } }))?.passwordHash).toBeTruthy()
    const passwordLogin = await request(app).post('/api/auth/login').send({ email: owner.email, password: 'password123' })
    expect(passwordLogin.status).toBe(200)
    const googleOnly = await request(app).post('/api/auth/login').send({ email: 'ada.google@example.com', password: 'password123' })
    expect(googleOnly.status).toBe(401)
    const staffAgain = await request(app).post('/api/admin/auth/login').send({ email: 'staff@example.com', password: 'change-me-now' })
    expect(staffAgain.status).toBe(200)
    expect((await request(app).get('/api/admin/auth/google/start')).status).toBe(404)
  })

  it('keeps Instagram connect on the local demo callback when no Meta app is configured', async () => {
    const { app } = testApp()
    const owner = await register(app)
    const started = await owner.api.get('/api/integrations/instagram/connect')
    expect(started.status).toBe(200)
    const authorizeUrl = new URL(started.body.authorizeUrl)
    expect(authorizeUrl.hostname).not.toBe('instagram.example')
    expect(authorizeUrl.pathname).toBe('/api/integrations/instagram/callback')
    expect(authorizeUrl.searchParams.get('code')).toBe('demo')
    const finished = await owner.api.get(`${authorizeUrl.pathname}${authorizeUrl.search}`)
    expect(finished.status).toBe(302)
    expect(finished.headers.location).toContain('/app/settings/instagram?connected=1')
    expect(String(finished.headers.location)).not.toContain('instagram.example')
    const accounts = await owner.api.get('/api/instagram/accounts')
    expect(accounts.status).toBe(200)
    expect(accounts.body.accounts[0].username).toBe('tester_demo')
    expect(accounts.body.accounts[0].status).toBe('connected')
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
