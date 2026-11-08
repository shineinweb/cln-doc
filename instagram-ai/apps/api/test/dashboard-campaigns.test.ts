import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { createPost, register, testApp, upgrade, uploadPng } from './helpers'

describe('Predis home and campaigns', () => {
  it('returns the next-7-days strip on the home dashboard', async () => {
    const { app } = testApp()
    const owner = await register(app)
    await upgrade(owner, 'growth')
    const post = await createPost(owner, { description: 'Week strip latte' })
    await uploadPng(owner, post.id)
    await owner.api.post(`/api/posts/${post.id}/approve`)
    const when = new Date()
    when.setDate(when.getDate() + 2)
    when.setHours(10, 0, 0, 0)
    const scheduled = await owner.api.post(`/api/posts/${post.id}/schedule`, { scheduledAt: when.toISOString() })
    expect(scheduled.status).toBe(200)

    const home = await owner.api.get('/api/dashboard')
    expect(home.status).toBe(200)
    expect(home.body.week).toBeTruthy()
    expect(home.body.weekStrip.some((row: { id: string }) => row.id === post.id)).toBe(true)
    expect(home.body.credits.image.remaining).toBeGreaterThanOrEqual(0)
    expect(home.body.charts.formatMix).toEqual(expect.any(Array))
  })

  it('keeps Auto Posting from publishing an unapproved draft', async () => {
    const { app, meta } = testApp()
    const owner = await register(app)
    await upgrade(owner, 'growth')
    const post = await createPost(owner, { description: 'Needs a person first' })
    await uploadPng(owner, post.id)
    const queue = await owner.api.get('/api/posts?status=DRAFT,PENDING_APPROVAL')
    expect(queue.status).toBe(200)
    expect(queue.body.posts.some((row: { id: string }) => row.id === post.id)).toBe(true)

    const publish = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(publish.status).toBe(409)
    expect(publish.body.error.code).toBe('approval_required')
    expect(meta.calls.some((call) => call.method === 'publishContainer')).toBe(false)

    const scheduledAttempt = await owner.api.post(`/api/posts/${post.id}/schedule`, {
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    expect(scheduledAttempt.status).toBe(409)
    expect(scheduledAttempt.body.error.code).toBe('approval_required')
  })

  it('sums only stored official campaign metrics and leaves empty totals empty', async () => {
    const { app } = testApp()
    const owner = await register(app)
    const post = await createPost(owner, { description: 'Campaign post' })
    const emptyCampaign = await owner.api.post('/api/campaigns', {
      name: 'Spring empty',
      startsAt: '2026-03-01T00:00:00.000Z',
      endsAt: '2026-03-31T23:59:59.999Z',
      postIds: [post.id],
    })
    expect(emptyCampaign.status).toBe(201)
    const emptyDash = await owner.api.get(`/api/campaigns/${emptyCampaign.body.campaign.id}`)
    expect(emptyDash.status).toBe(200)
    expect(emptyDash.body.totals).toEqual({ impressions: null, reach: null, engagement: null })
    expect(emptyDash.body.series.reach).toEqual([])
    expect(emptyDash.body.series.engagement).toEqual([])
    expect(emptyDash.body.byNetwork).toEqual([])

    await prisma.metricSnapshot.createMany({
      data: [
        {
          organizationId: owner.orgId,
          postId: post.id,
          network: 'instagram',
          metric: 'impressions',
          value: 120,
          capturedAt: new Date('2026-03-10T12:00:00.000Z'),
        },
        {
          organizationId: owner.orgId,
          postId: post.id,
          network: 'instagram',
          metric: 'reach',
          value: 80,
          capturedAt: new Date('2026-03-10T12:00:00.000Z'),
        },
        {
          organizationId: owner.orgId,
          postId: post.id,
          network: 'tiktok',
          metric: 'reach',
          value: 40,
          capturedAt: new Date('2026-03-11T12:00:00.000Z'),
        },
        {
          organizationId: owner.orgId,
          postId: post.id,
          network: 'instagram',
          metric: 'engagement',
          value: 15,
          capturedAt: new Date('2026-03-10T12:00:00.000Z'),
        },
        {
          organizationId: owner.orgId,
          postId: post.id,
          network: 'instagram',
          metric: 'saves',
          value: 999,
          capturedAt: new Date('2026-03-10T12:00:00.000Z'),
        },
      ],
    })

    const filled = await owner.api.get(`/api/campaigns/${emptyCampaign.body.campaign.id}`)
    expect(filled.status).toBe(200)
    expect(filled.body.totals).toEqual({ impressions: 120, reach: 120, engagement: 15 })
    expect(filled.body.series.reach).toEqual([
      { date: '2026-03-10', value: 80 },
      { date: '2026-03-11', value: 40 },
    ])
    expect(filled.body.byNetwork).toEqual([
      { name: 'instagram', value: 80 },
      { name: 'tiktok', value: 40 },
    ])
  })
})
