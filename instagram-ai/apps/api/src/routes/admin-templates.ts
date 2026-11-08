import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { asyncRoute } from '../http'
import { audit } from '../audit'
import { readPage } from '../paging'
import { readUpload } from '../upload'
import { isDisplayableImage } from '../providers/poster'
import { ART_STYLES } from '../providers/template-art'
import { requireStaff, requireStaffRole } from '../services/context'
import { saveSettings } from '../settings'
import {
  checkedShape,
  createTemplateRow,
  deleteTemplateRow,
  fieldsFromRow,
  listQuerySchema,
  listStaffTemplates,
  presentTemplate,
  presentTemplates,
  recordTemplateAudit,
  refreshThumbnail,
  removeTemplateAssets,
  seedStarterTemplates,
  storeTemplateAsset,
  templateFieldsSchema,
  updateTemplateRow,
} from '../services/templates'

const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])
const STATUS = z.enum(['draft', 'published'])

const createSchema = templateFieldsSchema.extend({
  status: STATUS.default('draft'),
  artStyle: z.enum(ART_STYLES).optional(),
})

export function adminTemplateRoutes(deps: Deps): Router {
  const router = Router()

  async function platformTemplate(id: string) {
    const row = await deps.prisma.template.findFirst({ where: { id, organizationId: null } })
    if (!row) throw notFound('Template not found')
    return row
  }

  router.get('/api/admin/templates', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    const query = listQuerySchema.parse({
      q: req.query.q || undefined,
      sort: req.query.sort || undefined,
      kind: req.query.kind || undefined,
      category: req.query.category || undefined,
      orientation: req.query.orientation || undefined,
      status: req.query.status || undefined,
    })
    const listed = await listStaffTemplates(deps, query, readPage(req.query))
    res.json({
      templates: await presentTemplates(deps, listed.rows),
      page: listed.page,
      pageSize: listed.pageSize,
      total: listed.total,
      facePersonalization: ctx.settings.features.facePersonalization,
    })
  }))

  router.put('/api/admin/templates/face-switch', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ enabled: z.boolean() }).parse(req.body ?? {})
    const before = ctx.settings.features.facePersonalization
    const settings = await saveSettings(deps.prisma, { features: { facePersonalization: body.enabled } } as never, deps.env.META_REDIRECT_URI)
    if (before !== body.enabled) {
      await audit(deps.prisma, {
        actorType: 'staff',
        actorId: ctx.staff.id,
        action: 'settings.face_personalization',
        targetType: 'feature',
        targetId: 'facePersonalization',
        metadata: { enabled: body.enabled },
      })
    }
    res.json({ facePersonalization: settings.features.facePersonalization })
  }))

  router.post('/api/admin/templates/seed', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const result = await seedStarterTemplates(deps)
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'template.seeded', metadata: result })
    res.json(result)
  }))

  router.post('/api/admin/templates', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = createSchema.parse(req.body ?? {})
    const row = await createTemplateRow(deps, {
      organizationId: null,
      fields: checkedShape(body),
      status: body.status,
      artStyle: body.artStyle,
    })
    await recordTemplateAudit(deps, { type: 'staff', id: ctx.staff.id }, 'template.created', row.id, { status: row.status })
    res.status(201).json({ template: await presentTemplate(deps, row) })
  }))

  router.get('/api/admin/templates/:id', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    res.json({ template: await presentTemplate(deps, await platformTemplate(req.params.id)) })
  }))

  router.patch('/api/admin/templates/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const row = await platformTemplate(req.params.id)
    const patch = templateFieldsSchema.partial().extend({ status: STATUS.optional() }).parse(req.body ?? {})
    const { status, ...rest } = patch
    const fields = checkedShape(templateFieldsSchema.parse({ ...fieldsFromRow(row), ...rest }))
    const updated = await updateTemplateRow(deps, row, fields, status)
    await recordTemplateAudit(deps, { type: 'staff', id: ctx.staff.id }, status && status !== row.status ? `template.${status === 'published' ? 'published' : 'unpublished'}` : 'template.updated', row.id)
    res.json({ template: await presentTemplate(deps, updated) })
  }))

  router.delete('/api/admin/templates/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const row = await platformTemplate(req.params.id)
    await deleteTemplateRow(deps, row)
    await recordTemplateAudit(deps, { type: 'staff', id: ctx.staff.id }, 'template.deleted', row.id, { title: row.title })
    res.json({ ok: true })
  }))

  router.post('/api/admin/templates/:id/image', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const row = await platformTemplate(req.params.id)
    const which = z.enum(['source', 'thumbnail']).parse(req.query.kind ?? 'source')
    const file = await readUpload(req)
    if (!IMAGE.has(file.mimeType) || !isDisplayableImage(file.buffer, file.mimeType)) {
      throw new ApiError(400, 'validation', 'Upload a PNG, JPEG, or WebP image')
    }
    const assetId = await storeTemplateAsset(deps, { organizationId: null, kind: which, bytes: file.buffer, mimeType: file.mimeType, filename: file.filename })
    if (which === 'source') {
      await deps.prisma.template.update({ where: { id: row.id }, data: { sourceAssetId: assetId } })
      await removeTemplateAssets(deps, [row.sourceAssetId])
      await refreshThumbnail(deps, row.id)
    } else {
      await deps.prisma.template.update({ where: { id: row.id }, data: { thumbnailAssetId: assetId, thumbnailCustom: true } })
      await removeTemplateAssets(deps, [row.thumbnailAssetId])
    }
    await recordTemplateAudit(deps, { type: 'staff', id: ctx.staff.id }, 'template.updated', row.id, { image: which })
    const fresh = await platformTemplate(row.id)
    res.json({ template: await presentTemplate(deps, fresh) })
  }))

  return router
}
