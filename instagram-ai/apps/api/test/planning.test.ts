import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { connectInstagram, createPost, metaSignature, register, testApp, uploadPng, upgrade } from './helpers'

describe('planning and inbox tools', () => {
  it('turns a saved idea into a draft that still needs approval', async () => {
    const { app, meta } = testApp()
    const owner = await register(app)
    const saved = await owner.api.post('/api/ideas', { text: 'Saturday tasting flight' })
    expect(saved.status).toBe(201)
    const draft = await owner.api.post(`/api/ideas/${saved.body.idea.id}/draft`)
    expect(draft.status).toBe(201)
    expect(draft.body.post.description).toBe('Saturday tasting flight')
    expect(draft.body.post.status).toBe('DRAFT')
    expect(draft.body.post.approvedAt).toBeNull()
    const publish = await owner.api.post(`/api/posts/${draft.body.post.id}/publish`)
    expect(publish.status).toBe(409)
    expect(publish.body.error.code).toBe('approval_required')
    expect(meta.calls.some((call) => call.method === 'publishContainer' || call.method === 'commentOnMedia')).toBe(false)
  })

  it('does not send a first comment before approval', async () => {
    const { app, meta } = testApp()
    const owner = await register(app)
    await connectInstagram(owner, 'first-comment')
    const account = (await owner.api.get('/api/instagram/accounts')).body.accounts[0]
    const post = await createPost(owner, {
      instagramAccountId: account.id,
      firstComment: 'Thanks for watching',
    })
    expect((await uploadPng(owner, post.id)).status).toBe(201)
    const early = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('approval_required')
    expect(meta.calls.some((call) => call.method === 'commentOnMedia')).toBe(false)
    expect((await prisma.post.findUnique({ where: { id: post.id } }))?.firstCommentIgId).toBeNull()

    await owner.api.post(`/api/posts/${post.id}/approve`)
    const published = await owner.api.post(`/api/posts/${post.id}/publish`)
    expect(published.status).toBe(200)
    expect(published.body.post.status).toBe('PUBLISHED')
    const comments = meta.calls.filter((call) => call.method === 'commentOnMedia')
    expect(comments).toHaveLength(1)
    expect(comments[0]?.message).toBe('Thanks for watching')
    expect(meta.calls.findIndex((call) => call.method === 'publishContainer')).toBeLessThan(
      meta.calls.findIndex((call) => call.method === 'commentOnMedia'),
    )

    meta.commentOnMediaError = 'Instagram rejected the comment'
    const failed = await createPost(owner, { instagramAccountId: account.id, firstComment: 'Second note' })
    await uploadPng(owner, failed.id)
    await owner.api.post(`/api/posts/${failed.id}/approve`)
    const result = await owner.api.post(`/api/posts/${failed.id}/publish`)
    expect(result.status).toBe(200)
    expect(result.body.post.status).toBe('PUBLISHED')
    expect(result.body.post.firstCommentError).toBe('Instagram rejected the comment')
    expect((await prisma.post.findUnique({ where: { id: failed.id } }))?.firstCommentIgId).toBeNull()
  })

  it('creates an unsent draft when a comment contains the keyword and does not follow or message', async () => {
    const { app, meta, env } = testApp()
    const owner = await register(app)
    await upgrade(owner, 'pro')
    await owner.api.put('/api/brand', {
      brandName: 'Cafe',
      approvedFacts: ['Follow me to get the link', 'We open at 7'],
    })
    await createPost(owner, { commentKeyword: 'menu', description: 'Weekly menu' })
    await connectInstagram(owner, 'keyword')
    const ig = await prisma.instagramAccount.findFirst({ where: { organizationId: owner.orgId } })
    meta.calls.length = 0
    const raw = JSON.stringify({
      entry: [{ id: ig!.igUserId, changes: [{ field: 'comments', value: { id: 'c-menu', text: 'Can I see the menu?', from: { id: 'fan', username: 'fan' } } }] }],
    })
    const webhook = await request(app)
      .post('/api/webhooks/instagram')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', metaSignature(env.META_APP_SECRET, raw))
      .send(raw)
    expect(webhook.status).toBe(200)
    const comment = await prisma.comment.findFirst({ where: { igCommentId: 'c-menu' } })
    expect(comment?.replied).toBe(false)
    expect(comment?.draftReply).toBe('We open at 7')
    expect(comment?.draftReply?.toLowerCase()).not.toContain('follow')
    expect(await prisma.conversation.count({ where: { organizationId: owner.orgId } })).toBe(0)
    expect(await prisma.message.count({ where: { organizationId: owner.orgId } })).toBe(0)
    expect(meta.calls).toEqual([])
  })

  it('returns no audience hours when none are stored', async () => {
    const { app, meta } = testApp()
    const owner = await register(app)
    const empty = await owner.api.get('/api/audience-times')
    expect(empty.status).toBe(200)
    expect(empty.body.hours).toEqual([])
    await upgrade(owner, 'pro')
    await connectInstagram(owner, 'hours')
    const insights = await owner.api.get('/api/insights')
    expect(insights.status).toBe(200)
    const afterInsights = await owner.api.get('/api/audience-times')
    expect(afterInsights.body.hours).toEqual([])
    expect(await prisma.metricSnapshot.count({ where: { organizationId: owner.orgId, metric: 'audience_online' } })).toBe(0)
    const before = meta.calls.filter((call) => call.method === 'getInsights').length
    await owner.api.get('/api/audience-times')
    expect(meta.calls.filter((call) => call.method === 'getInsights').length).toBe(before)

    meta.insights.audienceOnline = [{ hour: 18, value: 40 }]
    await owner.api.get('/api/insights')
    const stored = await owner.api.get('/api/audience-times')
    expect(stored.body.hours).toEqual([{ hour: 18, value: 40 }])
  })
})
