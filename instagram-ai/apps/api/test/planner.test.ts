import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { encryptString } from '../src/crypto'
import { prisma } from '../src/db'
import { createPost, publishDue, register, staffLogin, testApp, upgrade, type Deps, type Session } from './helpers'

function dayFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

async function account(deps: Deps, organizationId: string, network = 'facebook', name = 'page') {
  return prisma.socialAccount.create({
    data: {
      organizationId,
      network,
      externalId: `${network}-${name}`,
      displayName: name,
      username: name,
      status: 'connected',
      scopes: 'publish',
      credential: { create: { organizationId, accessTokenEnc: encryptString(`token-${network}-${name}`, deps.env.TOKEN_ENCRYPTION_KEY) } },
    },
  })
}

function weekBody(accountId: string, extra: Record<string, unknown> = {}) {
  return {
    range: 'week',
    startDate: dayFromNow(2),
    postsPerDay: 1,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    formats: ['photo', 'story'],
    socialAccountIds: [accountId],
    goal: 'Promote the spring menu',
    topics: ['New latte art', 'Meet the baristas'],
    promotions: '',
    tone: 'warm',
    language: 'en',
    useBestTimes: false,
    ...extra,
  }
}

async function setup() {
  const ctx = testApp()
  const owner = await register(ctx.app)
  await upgrade(owner, 'growth')
  const facebook = await account(ctx.deps, owner.orgId)
  return { ...ctx, owner, facebook }
}

async function createWeek(owner: Session, facebookId: string, extra: Record<string, unknown> = {}) {
  const res = await owner.api.post('/api/plans', weekBody(facebookId, extra))
  if (res.status !== 201) throw new Error(`plan failed ${res.status} ${JSON.stringify(res.body)}`)
  return res.body as { plan: { id: string }; posts: Array<{ id: string; status: string; format: string; scheduledAt: string; caption: string; description: string }>; total: number; copyErrors: number }
}

describe('AI content schedule planner', () => {
  it('drafts a week of posts that all wait for approval', async () => {
    const { owner, facebook, text } = await setup()
    const body = await createWeek(owner, facebook.id)
    expect(body.total).toBe(7)
    expect(body.posts).toHaveLength(7)
    expect(body.posts.every((post) => post.status === 'PENDING_APPROVAL')).toBe(true)
    expect(body.posts.map((post) => post.format)).toEqual(['photo', 'story', 'photo', 'story', 'photo', 'story', 'photo'])
    const rows = await prisma.post.findMany({ where: { organizationId: owner.orgId } })
    expect(rows).toHaveLength(7)
    expect(rows.every((row) => row.planId === body.plan.id && row.approvedAt === null && row.approvedById === null && row.scheduledAt)).toBe(true)
    expect(rows.every((row) => row.caption.length > 0)).toBe(true)
    expect(await prisma.postTarget.count({ where: { socialAccountId: facebook.id } })).toBe(7)
    expect(text.calls.filter((call) => call.kind === 'content_plan')).toHaveLength(1)
    expect(text.calls.filter((call) => call.kind === 'post_copy')).toHaveLength(7)
    expect(await prisma.aiUsage.count({ where: { organizationId: owner.orgId, kind: 'text' } })).toBe(8)
    expect(await prisma.generationJob.count()).toBe(0)
    const audits = await prisma.auditLog.findMany({ where: { organizationId: owner.orgId, action: 'plan.created' } })
    expect(audits).toHaveLength(1)

    const list = await owner.api.get('/api/plans')
    expect(list.body.plans).toHaveLength(1)
    expect(list.body.plans[0].counts).toMatchObject({ total: 7, pending: 7, scheduled: 0 })
    const detail = await owner.api.get(`/api/plans/${body.plan.id}`)
    expect(detail.body.posts[0].mediaState).toBe('none')
  })

  it('pages a month plan 20 at a time', async () => {
    const { owner, facebook } = await setup()
    const res = await owner.api.post('/api/plans', weekBody(facebook.id, { range: 'month', startDate: dayFromNow(1), formats: ['photo'] }))
    expect(res.status).toBe(201)
    expect(res.body.total).toBeGreaterThanOrEqual(28)
    expect(res.body.posts).toHaveLength(20)
    const second = await owner.api.get(`/api/plans/${res.body.plan.id}?page=2`)
    expect(second.body.posts).toHaveLength(res.body.total - 20)
    expect(second.body.page).toBe(2)
  })

  it('rejects bad plans before spending anything', async () => {
    const { owner, facebook, text } = await setup()
    const tooMany = await owner.api.post('/api/plans', weekBody(facebook.id, { range: 'month', postsPerDay: 3, startDate: dayFromNow(1) }))
    expect(tooMany.status).toBe(400)
    expect(tooMany.body.error.message).toMatch(/at most 31/)
    const past = await owner.api.post('/api/plans', weekBody(facebook.id, { startDate: dayFromNow(-3) }))
    expect(past.status).toBe(400)
    expect(past.body.error.message).toMatch(/past/)
    expect((await owner.api.post('/api/plans', weekBody(facebook.id, { formats: [] }))).status).toBe(400)
    expect((await owner.api.post('/api/plans', weekBody(facebook.id, { socialAccountIds: [] }))).status).toBe(400)
    expect((await owner.api.post('/api/plans', weekBody('not-an-account'))).status).toBe(400)
    expect((await owner.api.post('/api/plans', weekBody(facebook.id, { goal: '' }))).status).toBe(400)
    expect(text.calls).toHaveLength(0)
    expect(await prisma.contentPlan.count()).toBe(0)
    expect(await prisma.post.count()).toBe(0)
  })

  it('checks the plan, the text quota, and who is asking', async () => {
    const ctx = testApp()
    const starter = await register(ctx.app, 'Starter Co')
    const starterAccount = await account(ctx.deps, starter.orgId)
    const blocked = await starter.api.post('/api/plans', weekBody(starterAccount.id))
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('entitlement')

    const { owner, facebook, app } = await setup()
    const pkg = await prisma.subscription.findUnique({ where: { organizationId: owner.orgId }, include: { package: true } })
    const limit = pkg!.package.monthlyAiGenerations
    await prisma.aiUsage.createMany({
      data: Array.from({ length: limit - 3 }, () => ({
        organizationId: owner.orgId,
        kind: 'text',
        tokens: 1,
      })),
    })
    const quota = await owner.api.post('/api/plans', weekBody(facebook.id))
    expect(quota.status).toBe(403)
    expect(quota.body.error.code).toBe('quota_exceeded')
    expect(await prisma.contentPlan.count({ where: { organizationId: owner.orgId } })).toBe(0)

    const invited = await owner.api.post('/api/invitations', { email: 'sam-support@example.com', role: 'SUPPORT' })
    expect(invited.status).toBe(201)
    await request(app).post('/api/invitations/accept').send({ token: invited.body.token, name: 'Sam', password: 'password123' })
    const support = request.agent(app)
    const login = await support.post('/api/auth/login').send({ email: 'sam-support@example.com', password: 'password123' })
    const headers = { 'x-csrf-token': login.body.csrfToken, 'x-organization-id': owner.orgId }
    const denied = await support.post('/api/plans').set(headers).send(weekBody(facebook.id))
    expect(denied.status).toBe(403)

    const other = await register(app, 'Other Co')
    await upgrade(other, 'growth')
    const mine = await prisma.contentPlan.create({
      data: { organizationId: owner.orgId, range: 'day', startsAt: new Date(), endsAt: new Date(), inputs: {} },
    })
    expect((await other.api.get(`/api/plans/${mine.id}`)).status).toBe(404)
    expect((await other.api.del(`/api/plans/${mine.id}`)).status).toBe(404)
  })

  it('edits, moves, regenerates and deletes slots', async () => {
    const { owner, facebook, text } = await setup()
    const body = await createWeek(owner, facebook.id)
    const [first, second, third] = body.posts
    const url = `/api/plans/${body.plan.id}/posts`

    const edited = await owner.api.patch(`${url}/${first.id}`, { caption: 'My own words', hashtags: [{ tag: 'latte', enabled: true }] })
    expect(edited.status).toBe(200)
    const row = await prisma.post.findUnique({ where: { id: first.id } })
    expect(row?.caption).toBe('My own words')
    expect(row?.status).toBe('PENDING_APPROVAL')
    expect(row?.approvedAt).toBeNull()

    const when = new Date(Date.now() + 20 * 86_400_000)
    when.setUTCMinutes(0, 0, 0)
    const moved = await owner.api.patch(`${url}/${second.id}`, { scheduledAt: when.toISOString() })
    expect(moved.status).toBe(200)
    expect((await prisma.post.findUnique({ where: { id: second.id } }))?.scheduledAt?.toISOString()).toBe(when.toISOString())
    expect((await owner.api.patch(`${url}/${second.id}`, { scheduledAt: '2020-01-01T00:00:00.000Z' })).status).toBe(400)
    expect((await owner.api.patch(`${url}/${second.id}`, { hashtags: Array.from({ length: 11 }, (_, i) => ({ tag: `t${i}`, enabled: true })) })).status).toBe(400)

    const before = text.calls.length
    text.scripted.push({ slots: [{ index: 0, topic: 'A brand new topic', caption: 'Fresh caption', hashtags: ['fresh'] }] })
    const regenerated = await owner.api.post(`${url}/${third.id}/regenerate`)
    expect(regenerated.status).toBe(200)
    expect(regenerated.body.regenerated).toBe(1)
    expect((await prisma.post.findUnique({ where: { id: third.id } }))?.description).toBe('A brand new topic')
    expect(text.calls.length - before).toBe(2)

    expect((await owner.api.del(`${url}/${first.id}`)).status).toBe(200)
    expect(await prisma.post.findUnique({ where: { id: first.id } })).toBeNull()
    expect(await prisma.post.count({ where: { planId: body.plan.id } })).toBe(6)
    const bulk = await owner.api.post(`${url}/delete`, { postIds: [second.id, third.id] })
    expect(bulk.status).toBe(200)
    expect(bulk.body.deleted).toBe(2)
    expect(bulk.body.total).toBe(4)
    expect((await owner.api.del(`${url}/${first.id}`)).status).toBe(404)
    expect((await prisma.auditLog.count({ where: { organizationId: owner.orgId, action: { startsWith: 'plan.' } } }))).toBeGreaterThanOrEqual(5)
  })

  it('regenerates every unapproved slot and keeps approved ones', async () => {
    const { owner, facebook } = await setup()
    const body = await createWeek(owner, facebook.id)
    const keep = body.posts[0]
    await owner.api.post(`/api/plans/${body.plan.id}/approve`, { postIds: [keep.id] })
    const before = await prisma.post.findMany({ where: { planId: body.plan.id } })
    const result = await owner.api.post(`/api/plans/${body.plan.id}/regenerate`)
    expect(result.status).toBe(200)
    expect(result.body.regenerated).toBe(6)
    const kept = await prisma.post.findUnique({ where: { id: keep.id } })
    expect(kept?.status).toBe('SCHEDULED')
    expect(kept?.approvedAt).not.toBeNull()
    expect(before.length).toBe(7)
  })

  it('bulk approval schedules posts, generates media afterwards, and only approved posts publish', async () => {
    const { owner, facebook, deps, networks } = await setup()
    const body = await createWeek(owner, facebook.id)
    const ids = body.posts.map((post) => post.id)
    const blocked = await prisma.post.update({
      where: { id: ids[6] },
      data: { factualClaims: [{ claim: 'Free coffee for life', needsReview: true, accepted: false }] },
    })
    expect(blocked.status).toBe('PENDING_APPROVAL')

    const some = await owner.api.post(`/api/plans/${body.plan.id}/approve`, { postIds: [ids[0], ids[1]] })
    expect(some.status).toBe(200)
    expect(some.body.approved).toEqual([ids[0], ids[1]])
    expect(some.body.mediaQueued).toBe(2)
    const rows = await prisma.post.findMany({ where: { planId: body.plan.id }, include: { media: true }, orderBy: { scheduledAt: 'asc' } })
    const approved = rows.filter((row) => row.status === 'SCHEDULED')
    expect(approved).toHaveLength(2)
    expect(approved.every((row) => row.approvedAt && row.approvedById === owner.userId && row.media.length > 0)).toBe(true)
    expect(rows.filter((row) => row.status === 'PENDING_APPROVAL')).toHaveLength(5)
    expect(await prisma.generationJob.count({ where: { status: 'ready' } })).toBe(2)
    expect(await prisma.aiUsage.count({ where: { organizationId: owner.orgId, kind: 'text' } })).toBe(8)
    const targetStatuses = await prisma.postTarget.findMany({ where: { postId: { in: [ids[0], ids[1]] } } })
    expect(targetStatuses.every((target) => target.status === 'SCHEDULED')).toBe(true)

    const rest = await owner.api.post(`/api/plans/${body.plan.id}/approve`)
    expect(rest.status).toBe(200)
    expect(rest.body.approved).toHaveLength(4)
    expect(rest.body.skipped.map((item: { id: string; reason: string }) => item.id)).toEqual(expect.arrayContaining([ids[0], ids[1], ids[6]]))
    expect(rest.body.skipped.find((item: { id: string }) => item.id === ids[6]).reason).toMatch(/claim/)
    expect(rest.body.plan.counts).toMatchObject({ scheduled: 6, pending: 1 })

    await prisma.post.updateMany({ where: { planId: body.plan.id }, data: { scheduledAt: new Date(Date.now() - 60_000) } })
    await publishDue(deps)
    const published = await prisma.post.findMany({ where: { planId: body.plan.id } })
    expect(published.filter((row) => row.status === 'PUBLISHED')).toHaveLength(6)
    expect(published.find((row) => row.id === ids[6])?.status).toBe('PENDING_APPROVAL')
    const sent = networks.calls.filter((call) => call.method === 'publish')
    expect(sent).toHaveLength(6)
  })

  it('never publishes an unapproved slot, even when its time has come', async () => {
    const { owner, facebook, deps, networks } = await setup()
    const body = await createWeek(owner, facebook.id, { range: 'day', weekdays: [0, 1, 2, 3, 4, 5, 6] })
    expect(body.posts).toHaveLength(1)
    await prisma.post.updateMany({ where: { planId: body.plan.id }, data: { scheduledAt: new Date(Date.now() - 60_000) } })
    await publishDue(deps)
    expect(networks.calls.filter((call) => call.method === 'publish')).toEqual([])
    const row = await prisma.post.findFirst({ where: { planId: body.plan.id } })
    expect(row?.status).toBe('PENDING_APPROVAL')

    await prisma.post.update({ where: { id: row!.id }, data: { status: 'SCHEDULED' } })
    await publishDue(deps)
    expect(networks.calls.filter((call) => call.method === 'publish')).toEqual([])
    expect((await prisma.post.findUnique({ where: { id: row!.id } }))?.status).toBe('FAILED')
  })

  it('skips posts whose time has passed and lets Generate media run on demand', async () => {
    const { owner, facebook } = await setup()
    const body = await createWeek(owner, facebook.id, { range: 'day' })
    const post = body.posts[0]
    await prisma.post.update({ where: { id: post.id }, data: { scheduledAt: new Date(Date.now() - 60_000) } })
    const late = await owner.api.post(`/api/plans/${body.plan.id}/approve`)
    expect(late.body.approved).toEqual([])
    expect(late.body.skipped[0].reason).toMatch(/time has passed/)
    const generated = await owner.api.post(`/api/plans/${body.plan.id}/posts/${post.id}/media`)
    expect(generated.status).toBe(202)
    expect(generated.body.posts[0].mediaState).toBe('ready')
    expect((await prisma.post.findUnique({ where: { id: post.id } }))?.status).toBe('PENDING_APPROVAL')
  })

  it('deletes a whole plan but keeps what was already published', async () => {
    const { owner, facebook } = await setup()
    const body = await createWeek(owner, facebook.id)
    await prisma.post.update({ where: { id: body.posts[0].id }, data: { status: 'PUBLISHED', publishedAt: new Date() } })
    expect((await owner.api.del(`/api/plans/${body.plan.id}/posts/${body.posts[0].id}`)).status).toBe(409)
    const removed = await owner.api.del(`/api/plans/${body.plan.id}`)
    expect(removed.status).toBe(200)
    expect(removed.body).toMatchObject({ deleted: 6, kept: 1 })
    expect(await prisma.contentPlan.count()).toBe(0)
    const left = await prisma.post.findMany({ where: { organizationId: owner.orgId } })
    expect(left).toHaveLength(1)
    expect(left[0].planId).toBeNull()
  })

  it('falls back to built-in copy and says so when the admin turns OpenAI off', async () => {
    const { owner, facebook, app } = await setup()
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false })
    const body = await owner.api.post('/api/plans', weekBody(facebook.id, { range: 'day' }))
    expect(body.status).toBe(201)
    expect(body.body.notice).toBe('OpenAI is turned off by the admin, so the captions use the built-in copy.')
    expect(body.body.posts[0].caption.length).toBeGreaterThan(0)
  })

  it('attaches the plan to a campaign and uses stored audience hours for best times', async () => {
    const { owner, facebook } = await setup()
    const campaign = await owner.api.post('/api/campaigns', {
      name: 'Spring',
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      postIds: [(await createPost(owner)).id],
    })
    expect(campaign.status).toBe(201)
    await prisma.metricSnapshot.create({
      data: {
        organizationId: owner.orgId,
        metric: 'audience_online',
        value: 1,
        capturedAt: new Date(),
        dimensions: { hours: [{ hour: 20, value: 90 }, { hour: 7, value: 10 }] },
      },
    })
    const body = await owner.api.post('/api/plans', weekBody(facebook.id, { range: 'day', useBestTimes: true, campaignId: campaign.body.campaign.id }))
    expect(body.status).toBe(201)
    expect(new Date(body.body.posts[0].scheduledAt).getUTCHours()).toBe(20)
    expect(await prisma.campaignPost.count({ where: { campaignId: campaign.body.campaign.id } })).toBe(2)
    const missing = await owner.api.post('/api/plans', weekBody(facebook.id, { campaignId: 'nope' }))
    expect(missing.status).toBe(404)
  })
})
