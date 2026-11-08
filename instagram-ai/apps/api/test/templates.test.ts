import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { TINY_PNG } from '../src/providers/media'
import { renderLocalMarketingPoster } from '../src/providers/poster'
import { sweepFacePhotos } from '../src/services/faces'
import { STARTER_TEMPLATES, seedStarterTemplates } from '../src/services/templates'
import { register, staffLogin, testApp, upgrade, type Session } from './helpers'

const SLOTS = [
  { key: 'headline', label: 'Headline', default: 'Big news', maxLength: 20, position: 'headline', required: true },
  { key: 'subline', label: 'Subline', default: 'Read all about it', maxLength: 40, position: 'subline' },
  { key: 'cta', label: 'Call to action', default: 'Learn more', maxLength: 16, position: 'cta' },
  { key: 'badge1', label: 'Badge', default: 'New', maxLength: 12, position: 'badge' },
]

function fields(extra: Record<string, unknown> = {}) {
  return { title: 'Test template', kind: 'poster', category: 'Retail', tags: ['sale'], orientation: 'square', textSlots: SLOTS, hasFaceSlot: true, motionPrompt: '', ...extra }
}

async function platformTemplate(staff: Awaited<ReturnType<typeof staffLogin>>, extra: Record<string, unknown> = {}) {
  const res = await staff.api.post('/api/admin/templates', fields({ status: 'published', accentColor: '#2f80ed', ...extra }))
  if (res.status !== 201) throw new Error(`template failed ${JSON.stringify(res.body)}`)
  return res.body.template as { id: string; thumbnailUrl: string; sourceUrl: string }
}

async function bulkTemplates(count: number) {
  const slots = JSON.parse(JSON.stringify(SLOTS))
  await prisma.template.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      title: `Bulk ${String(i).padStart(2, '0')} ${i % 2 ? 'banner' : 'flyer'}`,
      kind: ['photo', 'poster', 'video'][i % 3] as string,
      category: i % 2 ? 'Events' : 'Retail',
      tags: [i % 2 ? 'party' : 'discount'],
      searchText: `bulk ${i} ${i % 2 ? 'banner events party' : 'flyer retail discount'}`,
      orientation: ['square', 'portrait', 'landscape'][i % 3] as string,
      durationSeconds: i % 3 === 2 ? 8 : null,
      textSlots: slots,
      hasFaceSlot: true,
      motionPrompt: '',
      status: 'published',
      useCount: i,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
    })),
  })
}

async function uploadFace(session: Session, consent = true) {
  return session.agent
    .post(`/api/templates/faces${consent ? '?consent=1' : ''}`)
    .set('x-csrf-token', session.csrf)
    .set('x-organization-id', session.orgId)
    .attach('file', TINY_PNG, { filename: 'me.png', contentType: 'image/png' })
}

describe('template catalog', () => {
  it('seeds twelve starter templates once and keeps admin edits on a second run', async () => {
    const { deps } = testApp()
    const first = await seedStarterTemplates(deps)
    expect(first).toEqual({ created: 12, skipped: 0 })
    const kinds = await prisma.template.groupBy({ by: ['kind'], _count: { _all: true } })
    expect(Object.fromEntries(kinds.map((row) => [row.kind, row._count._all]))).toEqual({ photo: 4, poster: 4, video: 4 })
    const row = await prisma.template.findUniqueOrThrow({ where: { seedKey: STARTER_TEMPLATES[0]!.key } })
    expect(row.status).toBe('published')
    expect(row.organizationId).toBeNull()
    expect(row.thumbnailAssetId).toBeTruthy()
    await prisma.template.update({ where: { id: row.id }, data: { title: 'Edited by staff' } })
    expect(await seedStarterTemplates(deps)).toEqual({ created: 0, skipped: 12 })
    expect(await prisma.template.count()).toBe(12)
    expect(await prisma.templateAsset.count()).toBe(24)
    expect((await prisma.template.findUniqueOrThrow({ where: { id: row.id } })).title).toBe('Edited by staff')
  }, 60000)

  it('searches, sorts, filters, and pages 20 per page', async () => {
    const { app } = testApp()
    const session = await register(app)
    await bulkTemplates(45)
    const first = await session.api.get('/api/templates')
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({ page: 1, pageSize: 20, total: 45, facePersonalization: true })
    expect(first.body.templates).toHaveLength(20)
    expect(first.body.templates[0].title).toBe('Bulk 44 flyer')
    const last = await session.api.get('/api/templates?page=3')
    expect(last.body.templates).toHaveLength(5)

    const popular = await session.api.get('/api/templates?sort=popular')
    expect(popular.body.templates.slice(0, 2).map((item: { useCount: number }) => item.useCount)).toEqual([44, 43])
    const name = await session.api.get('/api/templates?sort=name')
    expect(name.body.templates[0].title).toBe('Bulk 00 flyer')
    expect(name.body.templates[19].title).toBe('Bulk 19 banner')

    const search = await session.api.get('/api/templates?q=party')
    expect(search.body.total).toBe(22)
    expect(search.body.templates.every((item: { category: string }) => item.category === 'Events')).toBe(true)
    expect((await session.api.get('/api/templates?q=nomatch')).body.total).toBe(0)

    const video = await session.api.get('/api/templates?kind=video&orientation=landscape')
    expect(video.body.total).toBe(15)
    const category = await session.api.get('/api/templates?category=Retail&kind=photo')
    expect(category.body.templates.every((item: { kind: string; category: string }) => item.kind === 'photo' && item.category === 'Retail')).toBe(true)
    expect(first.body.categories).toEqual(['Events', 'Retail'])
    expect((await session.api.get('/api/templates?sort=bogus')).status).toBe(400)
  })

  it('shows platform published templates plus only the organization’s own private ones', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    const published = await platformTemplate(staff, { title: 'Published one' })
    const draft = await platformTemplate(staff, { title: 'Hidden draft', status: 'draft' })
    const a = await register(app, 'Org A')
    const b = await register(app, 'Org B')

    const made = await a.api.post('/api/templates', fields({ title: 'A private' }))
    expect(made.status).toBe(201)
    expect(made.body.template).toMatchObject({ mine: true, platform: false, status: 'published' })
    const privateId = made.body.template.id as string

    const titles = async (s: Session) => ((await s.api.get('/api/templates')).body.templates as Array<{ title: string }>).map((item) => item.title).sort()
    expect(await titles(a)).toEqual(['A private', 'Published one'])
    expect(await titles(b)).toEqual(['Published one'])
    expect((await a.api.get('/api/templates?tab=mine')).body.templates.map((item: { title: string }) => item.title)).toEqual(['A private'])
    expect((await b.api.get('/api/templates?tab=mine')).body.total).toBe(0)

    expect((await b.api.get(`/api/templates/${privateId}`)).status).toBe(404)
    expect((await a.api.get(`/api/templates/${draft.id}`)).status).toBe(404)
    expect((await a.api.get(`/api/templates/${published.id}`)).status).toBe(200)
    expect((await b.api.patch(`/api/templates/${privateId}`, { title: 'stolen' })).status).toBe(404)
    expect((await b.api.del(`/api/templates/${privateId}`)).status).toBe(404)
    expect((await a.api.patch(`/api/templates/${published.id}`, { title: 'mine now' })).status).toBe(403)
    expect((await a.api.del(`/api/templates/${published.id}`)).status).toBe(403)

    const patched = await a.api.patch(`/api/templates/${privateId}`, { title: 'A private renamed', tags: ['x', 'y'] })
    expect(patched.status).toBe(200)
    expect(patched.body.template).toMatchObject({ title: 'A private renamed', tags: ['x', 'y'] })
    expect((await a.api.get('/api/templates?q=renamed')).body.total).toBe(1)
    expect((await a.api.del(`/api/templates/${privateId}`)).status).toBe(200)
    expect((await a.api.get('/api/templates?tab=mine')).body.total).toBe(0)
    expect(await prisma.templateAsset.count({ where: { organizationId: a.orgId } })).toBe(0)
  })

  it('saves an existing post as a private template and rejects a bad shape', async () => {
    const { app } = testApp()
    const session = await register(app)
    const post = await session.api.post('/api/posts', { format: 'photo', description: 'Cafe poster' })
    const empty = await session.api.post('/api/templates', fields({ postId: post.body.post.id }))
    expect(empty.status).toBe(400)
    await session.agent.post(`/api/posts/${post.body.post.id}/media`).set('x-csrf-token', session.csrf).set('x-organization-id', session.orgId).attach('file', TINY_PNG, { filename: 'cup.png', contentType: 'image/png' })
    const saved = await session.api.post('/api/templates', fields({ postId: post.body.post.id }))
    expect(saved.status).toBe(201)
    expect(saved.body.template.sourceUrl).toContain('/media/')
    expect((await session.api.post('/api/templates', fields({ textSlots: [] }))).status).toBe(400)
    expect((await session.api.post('/api/templates', fields({ textSlots: [{ ...SLOTS[0], position: 'subline' }] }))).status).toBe(400)
    expect((await session.api.post('/api/templates', fields({ kind: 'video', orientation: 'square' }))).status).toBe(400)
    expect((await session.api.post('/api/templates', fields({ kind: 'video', orientation: 'portrait', durationSeconds: 9 }))).status).toBe(400)
  })

  it('lets only a super admin change the catalog, audits it, and lists drafts for staff', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    const made = await platformTemplate(staff, { title: 'Staff made', status: 'draft' })
    expect(made.thumbnailUrl).toContain('/media/')
    const list = await staff.api.get('/api/admin/templates?q=staff&status=draft')
    expect(list.body).toMatchObject({ total: 1, pageSize: 20, facePersonalization: true })
    const published = await staff.api.patch(`/api/admin/templates/${made.id}`, { status: 'published', title: 'Staff made v2' })
    expect(published.body.template).toMatchObject({ status: 'published', title: 'Staff made v2' })
    const png = await renderLocalMarketingPoster({ seed: 'up', size: 200, headline: 'Upload' })
    const up = await staff.agent.post(`/api/admin/templates/${made.id}/image?kind=source`).set('x-csrf-token', staff.csrf).attach('file', png, { filename: 'src.png', contentType: 'image/png' })
    expect(up.status).toBe(200)
    expect(up.body.template.sourceUrl).not.toBe(made.sourceUrl)
    expect((await staff.api.patch(`/api/admin/templates/${made.id}`, { motionPrompt: 'x'.repeat(1001) })).status).toBe(400)
    const actions = (await prisma.auditLog.findMany({ where: { targetId: made.id } })).map((row) => row.action).sort()
    expect(actions).toEqual(['template.created', 'template.published', 'template.updated'])
    const customer = await register(app)
    expect((await customer.api.get('/api/admin/templates')).status).toBe(401)
    expect((await staff.api.del(`/api/admin/templates/${made.id}`)).status).toBe(200)
    expect(await prisma.templateAsset.count()).toBe(0)
  })
})

describe('personalizing a template', () => {
  it('rejects a face without consent, bad text, and an over-quota organization, with no draft left behind', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    const tpl = await platformTemplate(staff)
    const session = await register(app)
    const face = await uploadFace(session)
    expect(face.status).toBe(201)
    const faceId = face.body.face.id as string

    const noConsent = await session.api.post(`/api/templates/${tpl.id}/personalize`, { faceAssetId: faceId, values: { headline: 'Hello' } })
    expect(noConsent.status).toBe(400)
    expect(noConsent.body.error.code).toBe('consent_required')
    expect((await uploadFace(session, false)).body.error.code).toBe('consent_required')

    const unknown = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { nope: 'x' } })
    expect(unknown.status).toBe(400)
    const tooLong = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'x'.repeat(21) } })
    expect(tooLong.status).toBe(400)
    expect(tooLong.body.error.message).toContain('at most 20 characters')
    const blank = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: '   ' } })
    expect(blank.status).toBe(400)
    expect(blank.body.error.message).toContain('is required')
    const other = await register(app, 'Other')
    expect((await other.api.post(`/api/templates/${tpl.id}/personalize`, { faceAssetId: faceId, consent: true })).status).toBe(404)

    const pkg = await prisma.package.findUniqueOrThrow({ where: { id: 'starter' } })
    await prisma.aiUsage.createMany({ data: Array.from({ length: pkg.monthlyImageGenerations }, () => ({ organizationId: session.orgId, kind: 'image', tokens: 0 })) })
    const over = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'Hello' } })
    expect(over.status).toBe(403)
    expect(over.body.error.code).toBe('quota_exceeded')
    expect(await prisma.post.count({ where: { organizationId: session.orgId } })).toBe(0)
    expect((await prisma.template.findUniqueOrThrow({ where: { id: tpl.id } })).useCount).toBe(0)
  })

  it('creates a draft poster with the personalized image, uses the image quota, and bumps the use count', async () => {
    const { app, deps, media } = testApp()
    const staff = await staffLogin(app)
    const tpl = await platformTemplate(staff)
    const session = await register(app)
    await prisma.brandProfile.updateMany({ where: { organizationId: session.orgId }, data: { brandName: 'Bean Co' } })
    const faceId = (await uploadFace(session)).body.face.id as string

    const res = await session.api.post(`/api/templates/${tpl.id}/personalize`, {
      values: { headline: 'Grand opening', subline: 'Free coffee all day', cta: 'Visit us' },
      faceAssetId: faceId,
      consent: true,
    })
    expect(res.status).toBe(201)
    const post = res.body.post
    expect(post).toMatchObject({ status: 'DRAFT', format: 'photo', templateId: tpl.id, approvedAt: null })
    expect(post.template).toMatchObject({ title: 'Test template', faceUsed: true, aiGenerated: true, values: { headline: 'Grand opening', subline: 'Free coffee all day', cta: 'Visit us', badge1: 'New' } })
    expect(post.template.aiNote).toContain('AI')
    expect(post.media).toHaveLength(1)
    expect(post.media[0].url).toContain('/media/')
    expect(post.description).toContain('Grand opening')
    expect(res.body.job).toMatchObject({ kind: 'image', status: 'ready' })
    expect(res.body.job.error).toContain('No OpenAI key is saved')
    expect(media.imageCalls).toBe(0)

    const stored = await prisma.postMedia.findFirstOrThrow({ where: { postId: post.id }, include: { asset: true } })
    expect(stored.asset.kind).toBe('generated_image')
    const file = await deps.storage.read(stored.asset.storageKey)
    expect(file?.bytes.subarray(1, 4).toString()).toBe('PNG')
    expect((await prisma.template.findUniqueOrThrow({ where: { id: tpl.id } })).useCount).toBe(1)
    expect(await prisma.aiUsage.count({ where: { organizationId: session.orgId, kind: 'image' } })).toBe(1)
    const actions = (await prisma.auditLog.findMany({ where: { organizationId: session.orgId } })).map((row) => row.action)
    expect(actions).toEqual(expect.arrayContaining(['face.consent', 'face.used', 'template.personalized']))
    expect((await session.api.get('/api/templates?tab=recent')).body.templates.map((item: { id: string }) => item.id)).toEqual([tpl.id])
    expect((await session.api.get('/api/templates?sort=popular')).body.templates[0]).toMatchObject({ id: tpl.id, useCount: 1 })

    const approved = await session.api.post(`/api/posts/${post.id}/approve`)
    expect(approved.body.post.approvedAt).toBeTruthy()
    const publish = await session.api.post(`/api/posts/${post.id}/publish`)
    expect(publish.status).toBeGreaterThanOrEqual(400)
  })

  it('previews text live and sends the template and the photo to OpenAI when a key is on, and not when it is off', async () => {
    const { app, deps, media } = testApp()
    const staff = await staffLogin(app)
    const tpl = await platformTemplate(staff, { kind: 'photo' })
    await staff.api.put('/api/admin/provider-secrets', { openaiKey: 'sk-template-key' })
    const session = await register(app)
    const faceId = (await uploadFace(session)).body.face.id as string

    const preview = await session.api.post(`/api/templates/${tpl.id}/preview`, { values: { headline: 'Preview me' } })
    expect(preview.status).toBe(200)
    expect(preview.body.image.startsWith('data:image/png;base64,')).toBe(true)
    expect(media.imageCalls).toBe(0)
    expect((await session.api.post(`/api/templates/${tpl.id}/preview`, { values: { headline: 'x'.repeat(30) } })).status).toBe(400)

    const on = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'With AI' }, faceAssetId: faceId, consent: true })
    expect(on.status).toBe(201)
    expect(media.imageCalls).toBe(1)
    expect(media.lastRequest?.apiKey).toBe('sk-template-key')
    expect(media.lastRequest?.reference?.bytes.equals(TINY_PNG)).toBe(true)
    expect(media.lastRequest?.styleGuide?.bytes.length).toBeGreaterThan(1000)
    expect(media.lastRequest?.prompt).toContain('likeness')
    expect(on.body.job.error).toBeNull()
    expect(await prisma.aiUsage.count({ where: { organizationId: session.orgId, kind: 'image' } })).toBe(1)

    await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false })
    const off = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'No AI' }, faceAssetId: faceId, consent: true })
    expect(off.status).toBe(201)
    expect(media.imageCalls).toBe(1)
    expect(off.body.job.error).toContain('OpenAI is turned off by the admin')
    expect(deps.env.MEDIA_PROVIDER_KEY).toBe('')
  })

  it('blocks the face part when the Face personalization switch is off, but still allows text-only drafts', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    const tpl = await platformTemplate(staff)
    const session = await register(app)
    const faceId = (await uploadFace(session)).body.face.id as string
    const off = await staff.api.put('/api/admin/templates/face-switch', { enabled: false })
    expect(off.body).toEqual({ facePersonalization: false })
    expect((await prisma.auditLog.findMany({ where: { action: 'settings.face_personalization' } }))).toHaveLength(1)

    const list = await session.api.get('/api/templates')
    expect(list.body.facePersonalization).toBe(false)
    const blocked = await session.api.post(`/api/templates/${tpl.id}/personalize`, { faceAssetId: faceId, consent: true })
    expect(blocked.status).toBe(403)
    expect(blocked.body.error).toMatchObject({ code: 'feature_disabled', message: 'Face personalization is turned off for the whole site' })
    expect((await uploadFace(session)).status).toBe(403)
    const textOnly = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'Text only' } })
    expect(textOnly.status).toBe(201)
    expect(textOnly.body.post.template.faceUsed).toBe(false)

    await staff.api.put('/api/admin/templates/face-switch', { enabled: true })
    expect((await session.api.post(`/api/templates/${tpl.id}/personalize`, { faceAssetId: faceId, consent: true })).status).toBe(201)
  })

  it('keeps viewers read-only and refuses a face on a template without a face slot', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    const noFace = await platformTemplate(staff, { hasFaceSlot: false })
    const session = await register(app)
    const faceId = (await uploadFace(session)).body.face.id as string
    const res = await session.api.post(`/api/templates/${noFace.id}/personalize`, { faceAssetId: faceId, consent: true })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('no place for a face')
    await prisma.membership.updateMany({ where: { organizationId: session.orgId }, data: { role: 'SUPPORT' } })
    expect((await session.api.get('/api/templates')).status).toBe(200)
    expect((await session.api.post(`/api/templates/${noFace.id}/personalize`, { values: { headline: 'Hi' } })).status).toBe(403)
    expect((await session.api.post('/api/templates', fields())).status).toBe(403)
    expect((await uploadFace(session)).status).toBe(403)
  })

  it('personalizes a video template through Runway with the personalized first frame and the motion prompt', async () => {
    const { app, deps } = testApp()
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { runwayKey: 'key_test_runway_template' })
    const tpl = await platformTemplate(staff, {
      kind: 'video',
      orientation: 'portrait',
      durationSeconds: 4,
      motionPrompt: 'The person smiles and nods toward the camera.',
    })
    const seen: Array<{ url: string; body?: { promptText?: string; promptImage?: Array<{ uri: string; position: string }>; ratio?: string } }> = []
    deps.videoFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      seen.push({ url, body })
      if (url.endsWith('/v1/image_to_video')) return new Response(JSON.stringify({ id: 'task_t' }), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.endsWith('/v1/tasks/task_t')) return new Response(JSON.stringify({ status: 'SUCCEEDED', output: ['https://cdn.example/t.mp4'] }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(Buffer.from('runway-clip'), { status: 200, headers: { 'content-type': 'video/mp4' } })
    }) as typeof fetch
    const session = await register(app)
    await upgrade(session, 'growth')
    const faceId = (await uploadFace(session)).body.face.id as string

    const res = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'Say hello' }, faceAssetId: faceId, consent: true })
    expect(res.status).toBe(201)
    expect(res.body.post).toMatchObject({ format: 'reel', durationSeconds: 4, status: 'DRAFT', templateId: tpl.id })
    expect(res.body.post.reference).toMatchObject({ mimeType: 'image/png' })
    expect(res.body.job.kind).toBe('video')
    expect(['ready', 'queued', 'running']).toContain(res.body.job.status)
    const runway = seen.find((item) => item.url.endsWith('/v1/image_to_video'))
    expect(runway?.body?.promptText).toContain('The person smiles and nods toward the camera.')
    expect(runway?.body?.promptText).toContain('Say hello')
    expect(runway?.body?.ratio).toBe('720:1280')
    expect(runway?.body?.promptImage?.[0]).toMatchObject({ position: 'first' })
    expect(runway?.body?.promptImage?.[0]?.uri.startsWith('data:image/png;base64,')).toBe(true)
    const job = await prisma.generationJob.findFirstOrThrow({ where: { postId: res.body.post.id } })
    expect(job.status).toBe('ready')
  }, 120000)

  it('falls back to the local designed ad for a video template when Runway is off or the plan has no video', async () => {
    const { app, deps } = testApp()
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { runwayKey: 'key_test_runway_off', runwayEnabled: false })
    const tpl = await platformTemplate(staff, { kind: 'video', orientation: 'landscape', durationSeconds: 8, motionPrompt: 'Slow push in.' })
    let fetched = 0
    deps.videoFetch = (async () => {
      fetched += 1
      throw new Error('runway must not be called')
    }) as typeof fetch
    const session = await register(app)
    await upgrade(session, 'growth')
    const res = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'Wide promo' } })
    expect(res.status).toBe(201)
    expect(res.body.post.format).toBe('video')
    expect(fetched).toBe(0)
    const job = await prisma.generationJob.findFirstOrThrow({ where: { postId: res.body.post.id } })
    expect(job.status).toBe('ready')
    expect(job.error).toContain('Runway is turned off by the admin')
    expect(job.error).toContain('local designed ad')
    const media = await prisma.postMedia.findFirstOrThrow({ where: { postId: res.body.post.id }, include: { asset: true } })
    expect(media.asset.kind).toBe('generated_video')

    await staff.api.put('/api/admin/settings', { features: { videoGeneration: false } })
    const blocked = await session.api.post(`/api/templates/${tpl.id}/personalize`, { values: { headline: 'Wide promo' } })
    expect(blocked.status).toBe(403)
    expect(blocked.body.error.code).toBe('feature_disabled')
    expect(await prisma.post.count({ where: { organizationId: session.orgId } })).toBe(1)
  }, 180000)
})

describe('face photo retention', () => {
  it('stores consent with a 30 day deadline, deletes on request, and sweeps expired photos', async () => {
    const { app, deps } = testApp()
    const session = await register(app)
    const up = await uploadFace(session)
    const face = up.body.face as { id: string; deleteAfter: string }
    const days = (new Date(face.deleteAfter).getTime() - Date.now()) / 86400000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
    const consent = await prisma.faceConsent.findFirstOrThrow({ where: { mediaAssetId: face.id } })
    expect(consent).toMatchObject({ organizationId: session.orgId, userId: session.userId, deletedAt: null })
    expect((await session.api.get('/api/templates/faces')).body.faces).toHaveLength(1)
    expect(((await session.api.get('/api/library')).body.assets as unknown[]).length).toBe(0)

    const second = (await uploadFace(session)).body.face as { id: string }
    const asset = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: second.id } })
    expect(await sweepFacePhotos(deps, new Date(Date.now() + 29 * 86400000))).toBe(0)
    expect(await sweepFacePhotos(deps, new Date(Date.now() + 31 * 86400000))).toBe(2)
    expect(await prisma.mediaAsset.count({ where: { kind: 'face' } })).toBe(0)
    expect(await deps.storage.read(asset.storageKey)).toBeNull()
    expect(await prisma.faceConsent.count({ where: { deletedAt: { not: null } } })).toBe(2)
    expect((await session.api.get('/api/templates/faces')).body.faces).toHaveLength(0)

    const third = (await uploadFace(session)).body.face as { id: string }
    const gone = await session.api.del(`/api/templates/faces/${third.id}`)
    expect(gone.status).toBe(200)
    expect(await prisma.mediaAsset.count({ where: { kind: 'face' } })).toBe(0)
    expect((await session.api.del(`/api/templates/faces/${third.id}`)).status).toBe(404)
    const actions = (await prisma.auditLog.findMany({ where: { organizationId: session.orgId } })).map((row) => row.action)
    expect(actions).toEqual(expect.arrayContaining(['face.consent', 'face.expired', 'face.deleted']))
  })

  it('does not let another organization use or delete a face photo', async () => {
    const { app } = testApp()
    const a = await register(app, 'Org A')
    const b = await register(app, 'Org B')
    const faceId = (await uploadFace(a)).body.face.id as string
    expect((await b.api.del(`/api/templates/faces/${faceId}`)).status).toBe(404)
    expect((await b.api.get('/api/templates/faces')).body.faces).toHaveLength(0)
  })
})
