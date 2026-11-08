import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, forbidden, notFound } from '../errors'
import { asyncRoute } from '../http'
import { readPage } from '../paging'
import { extensionFor, readUpload } from '../upload'
import { isDisplayableImage } from '../providers/poster'
import { ART_STYLES } from '../providers/template-art'
import { requireCustomer, requirePermission, requireWritable, type CustomerContext } from '../services/context'
import { loadBrandKit } from '../services/content'
import { deleteFacePhoto, listFacePhotos, storeFacePhoto, assertFaceFeature } from '../services/faces'
import { personalizeBodySchema, personalizeTemplate, previewTemplate } from '../services/personalize'
import {
  PRIVATE_TEMPLATE_LIMIT,
  checkedShape,
  createTemplateRow,
  deleteTemplateRow,
  fieldsFromRow,
  listCustomerTemplates,
  listQuerySchema,
  loadVisibleTemplate,
  presentTemplate,
  presentTemplates,
  recordTemplateAudit,
  templateFieldsSchema,
  updateTemplateRow,
} from '../services/templates'
import { loadPost, presentPostWithReference } from './customer'

const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])

const createSchema = templateFieldsSchema.extend({
  postId: z.string().min(1).max(191).optional(),
  artStyle: z.enum(ART_STYLES).optional(),
})

async function ownTemplate(deps: Deps, ctx: CustomerContext, id: string) {
  const row = await loadVisibleTemplate(deps, ctx, id)
  if (row.organizationId !== ctx.organization.id) throw forbidden('Platform templates are managed by staff')
  return row
}

export function templateRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/templates', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    const query = listQuerySchema.parse({
      q: req.query.q || undefined,
      sort: req.query.sort || undefined,
      kind: req.query.kind || undefined,
      category: req.query.category || undefined,
      orientation: req.query.orientation || undefined,
      tab: req.query.tab || undefined,
    })
    const page = readPage(req.query)
    const listed = await listCustomerTemplates(deps, ctx, query, page)
    res.json({
      templates: await presentTemplates(deps, listed.rows, ctx.organization.id),
      categories: listed.categories,
      page: listed.page,
      pageSize: listed.pageSize,
      total: listed.total,
      facePersonalization: ctx.settings.features.facePersonalization,
    })
  }))

  router.get('/api/templates/faces', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    res.json({ faces: await listFacePhotos(deps, ctx), facePersonalization: ctx.settings.features.facePersonalization })
  }))

  router.post('/api/templates/faces', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'ai.use')
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    assertFaceFeature(ctx)
    if (req.query.consent !== '1' && req.query.consent !== 'true') {
      throw new ApiError(400, 'consent_required', 'Confirm that this is your face, or that you have the person’s permission')
    }
    const file = await readUpload(req)
    if (!IMAGE.has(file.mimeType) || !isDisplayableImage(file.buffer, file.mimeType)) {
      throw new ApiError(400, 'validation', 'A face photo must be a PNG, JPEG, or WebP image')
    }
    res.status(201).json({ face: await storeFacePhoto(deps, ctx, file) })
  }))

  router.delete('/api/templates/faces/:id', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'posts.write')
    await deleteFacePhoto(deps, ctx, req.params.id)
    res.json({ ok: true })
  }))

  router.get('/api/templates/:id', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    const row = await loadVisibleTemplate(deps, ctx, req.params.id)
    res.json({ template: await presentTemplate(deps, row, ctx.organization.id), facePersonalization: ctx.settings.features.facePersonalization })
  }))

  router.post('/api/templates', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    const body = createSchema.parse(req.body ?? {})
    const fields = checkedShape(body)
    const mine = await deps.prisma.template.count({ where: { organizationId: ctx.organization.id } })
    if (mine >= PRIVATE_TEMPLATE_LIMIT) {
      throw new ApiError(409, 'limit_reached', `An organization can keep up to ${PRIVATE_TEMPLATE_LIMIT} private templates`)
    }
    let source: { bytes: Buffer; mimeType: string; filename: string } | undefined
    if (body.postId) {
      const post = await loadPost(deps, ctx, body.postId)
      const image = post.media.find((item) => IMAGE.has(item.asset.mimeType))
      const frame = !image && post.referenceAssetId
        ? await deps.prisma.mediaAsset.findFirst({ where: { id: post.referenceAssetId, organizationId: ctx.organization.id } })
        : null
      const asset = image?.asset ?? frame
      const file = asset ? await deps.storage.read(asset.storageKey) : null
      if (!asset || !file || !isDisplayableImage(file.bytes, asset.mimeType || file.mimeType)) {
        throw new ApiError(400, 'validation', 'Save a post that has a photo or poster as a template')
      }
      source = { bytes: file.bytes, mimeType: asset.mimeType || file.mimeType, filename: `source.${extensionFor(asset.mimeType, asset.filename)}` }
    }
    const kit = fields.accentColor ? null : await loadBrandKit(deps, ctx.organization.id)
    const row = await createTemplateRow(deps, {
      organizationId: ctx.organization.id,
      fields: { ...fields, accentColor: fields.accentColor ?? kit?.primaryColor ?? null },
      status: 'published',
      source,
      artStyle: body.artStyle,
    })
    await recordTemplateAudit(deps, { type: 'user', id: ctx.user.id, organizationId: ctx.organization.id }, 'template.created', row.id)
    res.status(201).json({ template: await presentTemplate(deps, row, ctx.organization.id) })
  }))

  router.patch('/api/templates/:id', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    const row = await ownTemplate(deps, ctx, req.params.id)
    const patch = templateFieldsSchema.partial().parse(req.body ?? {})
    const fields = checkedShape(templateFieldsSchema.parse({ ...fieldsFromRow(row), ...patch }))
    const updated = await updateTemplateRow(deps, row, fields)
    await recordTemplateAudit(deps, { type: 'user', id: ctx.user.id, organizationId: ctx.organization.id }, 'template.updated', row.id)
    res.json({ template: await presentTemplate(deps, updated, ctx.organization.id) })
  }))

  router.delete('/api/templates/:id', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'posts.write')
    const row = await ownTemplate(deps, ctx, req.params.id)
    await deleteTemplateRow(deps, row)
    await recordTemplateAudit(deps, { type: 'user', id: ctx.user.id, organizationId: ctx.organization.id }, 'template.deleted', row.id)
    res.json({ ok: true })
  }))

  router.post('/api/templates/:id/preview', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    const row = await loadVisibleTemplate(deps, ctx, req.params.id)
    const body = personalizeBodySchema.parse(req.body ?? {})
    res.json({ image: await previewTemplate(deps, ctx, row, body) })
  }))

  router.post('/api/templates/:id/personalize', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    requirePermission(ctx, 'ai.use')
    requirePermission(ctx, 'posts.write')
    const row = await loadVisibleTemplate(deps, ctx, req.params.id)
    const body = personalizeBodySchema.parse(req.body ?? {})
    const result = await personalizeTemplate(deps, ctx, row, body)
    const post = await loadPost(deps, ctx, result.postId)
    const job = await deps.prisma.generationJob.findUnique({ where: { id: result.jobId } })
    if (!post) throw notFound('Post not found')
    res.status(201).json({ post: await presentPostWithReference(deps, post), job, copyError: result.copyError })
  }))

  return router
}
