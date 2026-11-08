import { defaultDuration, durationAllowed, normalizeHexColor } from '@instagram-ai/shared'
import type { Prisma, Template } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { pageArgs, pageBody } from '../paging'
import { isDisplayableImage, renderLocalMarketingPoster, type PosterCanvas } from '../providers/poster'
import { ART_STYLES, renderTemplateArt, type ArtStyle } from '../providers/template-art'
import { audit } from '../audit'
import type { CustomerContext } from './context'

export const TEMPLATE_KINDS = ['photo', 'poster', 'video'] as const
export const ORIENTATIONS = ['square', 'portrait', 'landscape'] as const
export const SLOT_POSITIONS = ['headline', 'subline', 'cta', 'badge'] as const
export const TEMPLATE_SORTS = ['newest', 'popular', 'name'] as const
export const TEMPLATE_TABS = ['all', 'mine', 'recent'] as const
export const PRIVATE_TEMPLATE_LIMIT = 100

export type TemplateKind = (typeof TEMPLATE_KINDS)[number]
export type Orientation = (typeof ORIENTATIONS)[number]
export type TextSlot = {
  key: string
  label: string
  default: string
  maxLength: number
  position: (typeof SLOT_POSITIONS)[number]
  required: boolean
}

export const textSlotSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,23}$/, 'A text slot key uses lowercase letters, numbers, and underscores'),
  label: z.string().trim().min(1, 'Every text slot needs a label').max(60),
  default: z.string().max(200).default(''),
  maxLength: z.number().int().min(1).max(200).default(60),
  position: z.enum(SLOT_POSITIONS),
  required: z.boolean().default(false),
})

export const textSlotsSchema = z.array(textSlotSchema).min(1, 'Add at least one text slot').max(6, 'A template can have at most 6 text slots').superRefine((slots, ctx) => {
  const keys = new Set<string>()
  const counts: Record<string, number> = {}
  for (const slot of slots) {
    if (keys.has(slot.key)) ctx.addIssue({ code: 'custom', message: `The text slot key "${slot.key}" is used twice` })
    keys.add(slot.key)
    counts[slot.position] = (counts[slot.position] ?? 0) + 1
    if (slot.default.length > slot.maxLength) {
      ctx.addIssue({ code: 'custom', message: `The default for "${slot.label}" is longer than its ${slot.maxLength} character limit` })
    }
  }
  for (const position of ['headline', 'subline', 'cta'] as const) {
    if ((counts[position] ?? 0) > 1) ctx.addIssue({ code: 'custom', message: `Only one ${position} slot is allowed` })
  }
  if ((counts.badge ?? 0) > 3) ctx.addIssue({ code: 'custom', message: 'At most 3 badge slots are allowed' })
  if (!counts.headline) ctx.addIssue({ code: 'custom', message: 'A template needs a headline slot' })
})

const tagsSchema = z.array(z.string().trim().min(1).max(24)).max(8)

export const templateFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Give the template a title').max(120),
  kind: z.enum(TEMPLATE_KINDS),
  category: z.string().trim().max(60).default(''),
  tags: tagsSchema.default([]),
  orientation: z.enum(ORIENTATIONS).default('square'),
  durationSeconds: z.number().int().nullable().optional(),
  textSlots: textSlotsSchema,
  hasFaceSlot: z.boolean().default(true),
  motionPrompt: z.string().max(1000).default(''),
  accentColor: z.string().max(16).nullable().optional(),
})

export type TemplateFields = z.infer<typeof templateFieldsSchema>

export function formatFor(kind: string, orientation: string): 'photo' | 'story' | 'reel' | 'video' {
  if (kind === 'video') return orientation === 'portrait' ? 'reel' : 'video'
  return orientation === 'portrait' ? 'story' : 'photo'
}

export function canvasFor(orientation: string): PosterCanvas {
  return orientation === 'portrait' ? 'tall' : orientation === 'landscape' ? 'wide' : 'square'
}

export function checkedShape(fields: TemplateFields): TemplateFields & { durationSeconds: number | null; accentColor: string | null } {
  let durationSeconds: number | null = null
  if (fields.kind === 'video') {
    if (fields.orientation === 'square') {
      throw new ApiError(400, 'validation', 'A video template is portrait (Reel) or landscape (video)')
    }
    const format = formatFor(fields.kind, fields.orientation)
    durationSeconds = fields.durationSeconds ?? defaultDuration(format) ?? 8
    if (!durationAllowed(format, durationSeconds)) {
      throw new ApiError(400, 'validation', format === 'reel' ? 'A Reel can be 4, 8, or 12 seconds' : 'A video can be 8, 15, or 30 seconds')
    }
  }
  return { ...fields, durationSeconds, accentColor: normalizeHexColor(fields.accentColor) }
}

export function searchTextFor(fields: { title: string; category: string; tags: string[] }): string {
  return [fields.title, fields.category, ...fields.tags].join(' ').toLowerCase()
}

export function readSlots(value: Prisma.JsonValue): TextSlot[] {
  const parsed = z.array(textSlotSchema).safeParse(value)
  return parsed.success ? parsed.data : []
}

export function readTags(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function visibleWhere(organizationId: string): Prisma.TemplateWhereInput {
  return { OR: [{ organizationId: null, status: 'published' }, { organizationId }] }
}

export async function loadVisibleTemplate(deps: Deps, ctx: CustomerContext, id: string): Promise<Template> {
  const row = await deps.prisma.template.findFirst({ where: { id, ...visibleWhere(ctx.organization.id) } })
  if (!row) throw notFound('Template not found')
  return row
}

async function assetUrls(deps: Deps, rows: Template[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => [row.sourceAssetId, row.thumbnailAssetId]).filter((id): id is string => Boolean(id)))]
  if (!ids.length) return new Map()
  const assets = await deps.prisma.templateAsset.findMany({ where: { id: { in: ids } } })
  return new Map(assets.map((asset) => [asset.id, deps.storage.url(asset.storageKey)]))
}

export async function presentTemplates(deps: Deps, rows: Template[], organizationId?: string) {
  const urls = await assetUrls(deps, rows)
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    category: row.category,
    tags: readTags(row.tags),
    orientation: row.orientation,
    durationSeconds: row.durationSeconds,
    format: formatFor(row.kind, row.orientation),
    textSlots: readSlots(row.textSlots),
    hasFaceSlot: row.hasFaceSlot,
    motionPrompt: row.motionPrompt,
    accentColor: row.accentColor,
    status: row.status,
    useCount: row.useCount,
    platform: row.organizationId === null,
    mine: organizationId ? row.organizationId === organizationId : false,
    thumbnailUrl: row.thumbnailAssetId ? urls.get(row.thumbnailAssetId) ?? null : null,
    sourceUrl: row.sourceAssetId ? urls.get(row.sourceAssetId) ?? null : null,
    createdAt: row.createdAt,
  }))
}

export async function presentTemplate(deps: Deps, row: Template, organizationId?: string) {
  const [one] = await presentTemplates(deps, [row], organizationId)
  return one as NonNullable<typeof one>
}

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(TEMPLATE_SORTS).default('newest'),
  kind: z.enum(TEMPLATE_KINDS).optional(),
  category: z.string().trim().max(60).optional(),
  orientation: z.enum(ORIENTATIONS).optional(),
  tab: z.enum(TEMPLATE_TABS).default('all'),
  status: z.enum(['draft', 'published']).optional(),
})

export type ListQuery = z.infer<typeof listQuerySchema>

function orderFor(sort: ListQuery['sort']): Prisma.TemplateOrderByWithRelationInput[] {
  if (sort === 'popular') return [{ useCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]
  if (sort === 'name') return [{ title: 'asc' }, { id: 'asc' }]
  return [{ createdAt: 'desc' }, { id: 'desc' }]
}

export function filterWhere(query: ListQuery): Prisma.TemplateWhereInput[] {
  const parts: Prisma.TemplateWhereInput[] = []
  if (query.q) parts.push({ searchText: { contains: query.q.toLowerCase() } })
  if (query.kind) parts.push({ kind: query.kind })
  if (query.category) parts.push({ category: query.category })
  if (query.orientation) parts.push({ orientation: query.orientation })
  return parts
}

export async function listCustomerTemplates(deps: Deps, ctx: CustomerContext, query: ListQuery, page: number) {
  const orgId = ctx.organization.id
  const base = visibleWhere(orgId)
  const parts = filterWhere(query)
  const categories = (await deps.prisma.template.groupBy({ by: ['category'], where: base, orderBy: { category: 'asc' } }))
    .map((row) => row.category)
    .filter(Boolean)
  if (query.tab === 'mine') parts.push({ organizationId: orgId })
  if (query.tab === 'recent') {
    const used = await deps.prisma.post.groupBy({
      by: ['templateId'],
      where: { organizationId: orgId, templateId: { not: null } },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 200,
    })
    const order = used.map((row) => row.templateId).filter((id): id is string => Boolean(id))
    const where: Prisma.TemplateWhereInput = { AND: [base, { id: { in: order } }, ...parts] }
    const rows = await deps.prisma.template.findMany({ where })
    rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    const start = (page - 1) * pageArgs(page).take
    const slice = rows.slice(start, start + pageArgs(page).take)
    return { rows: slice, categories, ...pageBody(page, rows.length) }
  }
  const where: Prisma.TemplateWhereInput = { AND: [base, ...parts] }
  const [total, rows] = await Promise.all([
    deps.prisma.template.count({ where }),
    deps.prisma.template.findMany({ where, orderBy: orderFor(query.sort), ...pageArgs(page) }),
  ])
  return { rows, categories, ...pageBody(page, total) }
}

export async function listStaffTemplates(deps: Deps, query: ListQuery, page: number) {
  const parts = filterWhere(query)
  if (query.status) parts.push({ status: query.status })
  const where: Prisma.TemplateWhereInput = { AND: [{ organizationId: null }, ...parts] }
  const [total, rows] = await Promise.all([
    deps.prisma.template.count({ where }),
    deps.prisma.template.findMany({ where, orderBy: orderFor(query.sort), ...pageArgs(page) }),
  ])
  return { rows, ...pageBody(page, total) }
}

export async function storeTemplateAsset(
  deps: Deps,
  input: { organizationId: string | null; kind: 'source' | 'thumbnail'; bytes: Buffer; mimeType: string; filename: string },
): Promise<string> {
  const ext = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType === 'image/webp' ? 'webp' : 'png'
  const storageKey = await deps.storage.put(input.bytes, ext)
  const asset = await deps.prisma.templateAsset.create({
    data: { organizationId: input.organizationId, kind: input.kind, storageKey, mimeType: input.mimeType, filename: input.filename },
  })
  return asset.id
}

export async function removeTemplateAssets(deps: Deps, ids: Array<string | null | undefined>): Promise<void> {
  const wanted = ids.filter((id): id is string => Boolean(id))
  if (!wanted.length) return
  const assets = await deps.prisma.templateAsset.findMany({ where: { id: { in: wanted } } })
  await deps.prisma.templateAsset.deleteMany({ where: { id: { in: wanted } } })
  for (const asset of assets) await deps.storage.remove(asset.storageKey)
}

export async function readTemplateAsset(deps: Deps, id: string | null): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!id) return null
  const asset = await deps.prisma.templateAsset.findUnique({ where: { id } })
  if (!asset) return null
  const file = await deps.storage.read(asset.storageKey)
  if (!file || !isDisplayableImage(file.bytes, asset.mimeType || file.mimeType)) return null
  return { bytes: file.bytes, mimeType: asset.mimeType || file.mimeType }
}

export type RenderInput = {
  kind?: string
  orientation: string
  slots: TextSlot[]
  values: Record<string, string>
  hero: Buffer | null
  size: number
  accent?: string | null
  brandName?: string
  logo?: Buffer | null
  fallbackBadge?: string
  seed: string
}

export function resolveValues(slots: TextSlot[], given: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slot of slots) {
    const raw = given?.[slot.key]
    out[slot.key] = typeof raw === 'string' ? raw.trim() : slot.default
  }
  return out
}

export async function renderTemplateImage(input: RenderInput): Promise<Buffer> {
  const pick = (position: TextSlot['position']) => input.slots.find((slot) => slot.position === position)
  const text = (position: TextSlot['position']) => {
    const slot = pick(position)
    return slot ? (input.values[slot.key] ?? '').trim() : ''
  }
  const services = input.slots
    .filter((slot) => slot.position === 'badge')
    .map((slot) => (input.values[slot.key] ?? '').trim())
    .filter(Boolean)
  return renderLocalMarketingPoster({
    seed: input.seed,
    size: input.size,
    canvas: canvasFor(input.orientation),
    variant: 'poster',
    brandName: input.brandName || 'Your Brand',
    headline: text('headline'),
    tagline: text('subline'),
    cta: text('cta') || null,
    services: services.length ? services : [input.fallbackBadge || 'Special offer'],
    color: input.accent ?? null,
    logo: input.logo ?? null,
    hero: input.hero,
  })
}

export async function buildThumbnail(deps: Deps, row: Pick<Template, 'id' | 'orientation' | 'textSlots' | 'accentColor' | 'category' | 'sourceAssetId'>): Promise<Buffer> {
  const source = await readTemplateAsset(deps, row.sourceAssetId)
  const slots = readSlots(row.textSlots)
  return renderTemplateImage({
    orientation: row.orientation,
    slots,
    values: resolveValues(slots, undefined),
    hero: source?.bytes ?? null,
    size: 480,
    accent: row.accentColor,
    fallbackBadge: row.category,
    seed: `thumb-${row.id}`,
  })
}

export async function refreshThumbnail(deps: Deps, templateId: string): Promise<void> {
  const row = await deps.prisma.template.findUnique({ where: { id: templateId } })
  if (!row || row.thumbnailCustom) return
  const bytes = await buildThumbnail(deps, row)
  const assetId = await storeTemplateAsset(deps, { organizationId: row.organizationId, kind: 'thumbnail', bytes, mimeType: 'image/png', filename: `${row.id}-thumb.png` })
  const previous = row.thumbnailAssetId
  await deps.prisma.template.update({ where: { id: row.id }, data: { thumbnailAssetId: assetId } })
  await removeTemplateAssets(deps, [previous])
}

export async function createTemplateRow(
  deps: Deps,
  input: {
    organizationId: string | null
    fields: ReturnType<typeof checkedShape>
    status: 'draft' | 'published'
    seedKey?: string
    source?: { bytes: Buffer; mimeType: string; filename: string }
    artStyle?: ArtStyle
  },
): Promise<Template> {
  const { fields } = input
  const art = input.source ?? {
    bytes: renderTemplateArt({
      style: input.artStyle ?? ART_STYLES[Math.abs(hashString(fields.title)) % ART_STYLES.length] as ArtStyle,
      accent: fields.accentColor,
      seed: input.seedKey ?? fields.title,
    }),
    mimeType: 'image/png',
    filename: 'source.png',
  }
  const sourceAssetId = await storeTemplateAsset(deps, { organizationId: input.organizationId, kind: 'source', bytes: art.bytes, mimeType: art.mimeType, filename: art.filename })
  let created: Template
  try {
    created = await deps.prisma.template.create({
      data: {
        organizationId: input.organizationId,
        seedKey: input.seedKey,
        title: fields.title,
        kind: fields.kind,
        category: fields.category,
        tags: fields.tags,
        searchText: searchTextFor(fields),
        sourceAssetId,
        orientation: fields.orientation,
        durationSeconds: fields.durationSeconds,
        accentColor: fields.accentColor,
        textSlots: fields.textSlots as unknown as Prisma.InputJsonValue,
        hasFaceSlot: fields.hasFaceSlot,
        motionPrompt: fields.motionPrompt,
        status: input.status,
      },
    })
  } catch (error) {
    await removeTemplateAssets(deps, [sourceAssetId])
    throw error
  }
  await refreshThumbnail(deps, created.id)
  return (await deps.prisma.template.findUnique({ where: { id: created.id } })) ?? created
}

function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = (Math.imul(h, 31) + value.charCodeAt(i)) | 0
  return h
}

export async function updateTemplateRow(deps: Deps, row: Template, fields: ReturnType<typeof checkedShape>, status?: 'draft' | 'published'): Promise<Template> {
  const updated = await deps.prisma.template.update({
    where: { id: row.id },
    data: {
      title: fields.title,
      kind: fields.kind,
      category: fields.category,
      tags: fields.tags,
      searchText: searchTextFor(fields),
      orientation: fields.orientation,
      durationSeconds: fields.durationSeconds,
      accentColor: fields.accentColor,
      textSlots: fields.textSlots as unknown as Prisma.InputJsonValue,
      hasFaceSlot: fields.hasFaceSlot,
      motionPrompt: fields.motionPrompt,
      ...(status ? { status } : {}),
    },
  })
  await refreshThumbnail(deps, updated.id)
  return (await deps.prisma.template.findUnique({ where: { id: updated.id } })) ?? updated
}

export async function deleteTemplateRow(deps: Deps, row: Template): Promise<void> {
  await deps.prisma.template.delete({ where: { id: row.id } })
  await removeTemplateAssets(deps, [row.sourceAssetId, row.thumbnailAssetId])
}

export function fieldsFromRow(row: Template): TemplateFields {
  return {
    title: row.title,
    kind: row.kind as TemplateKind,
    category: row.category,
    tags: readTags(row.tags),
    orientation: row.orientation as Orientation,
    durationSeconds: row.durationSeconds,
    textSlots: readSlots(row.textSlots),
    hasFaceSlot: row.hasFaceSlot,
    motionPrompt: row.motionPrompt,
    accentColor: row.accentColor,
  }
}

export async function recordTemplateAudit(
  deps: Deps,
  actor: { type: 'user' | 'staff'; id: string; organizationId?: string | null },
  action: string,
  templateId: string,
  metadata?: Prisma.InputJsonValue,
): Promise<void> {
  await audit(deps.prisma, {
    organizationId: actor.organizationId ?? null,
    actorType: actor.type,
    actorId: actor.id,
    action,
    targetType: 'template',
    targetId: templateId,
    metadata,
  })
}

type Seed = {
  key: string
  title: string
  kind: TemplateKind
  category: string
  tags: string[]
  orientation: Orientation
  durationSeconds?: number
  color: string
  style: ArtStyle
  hasFaceSlot: boolean
  motionPrompt?: string
  slots: Array<Omit<TextSlot, 'required'> & { required?: boolean }>
}

const slot = (key: string, label: string, def: string, maxLength: number, position: TextSlot['position'], required = false) => ({ key, label, default: def, maxLength, position, required })

export const STARTER_TEMPLATES: Seed[] = [
  {
    key: 'starter-coffee-special', title: 'Coffee shop daily special', kind: 'photo', category: 'Food & Drink', tags: ['coffee', 'cafe', 'menu', 'special'],
    orientation: 'square', color: '#c8742c', style: 'bokeh', hasFaceSlot: false,
    slots: [slot('headline', 'Headline', "Today's special", 40, 'headline', true), slot('subline', 'Subline', 'Fresh roast, baked this morning', 80, 'subline'), slot('cta', 'Call to action', 'Order ahead', 24, 'cta'), slot('badge1', 'Badge 1', 'Fresh daily', 20, 'badge'), slot('badge2', 'Badge 2', 'Local beans', 20, 'badge')],
  },
  {
    key: 'starter-new-arrival', title: 'New arrival spotlight', kind: 'photo', category: 'Retail', tags: ['retail', 'product', 'launch', 'new'],
    orientation: 'square', color: '#2f80ed', style: 'mesh', hasFaceSlot: false,
    slots: [slot('headline', 'Headline', 'Just landed', 40, 'headline', true), slot('subline', 'Subline', 'Meet the newest addition to our shelves', 80, 'subline'), slot('cta', 'Call to action', 'Shop now', 24, 'cta'), slot('badge1', 'Badge 1', 'New in', 20, 'badge'), slot('badge2', 'Badge 2', 'Limited run', 20, 'badge')],
  },
  {
    key: 'starter-team-spotlight', title: 'Meet the team', kind: 'photo', category: 'People', tags: ['team', 'staff', 'introduce', 'people'],
    orientation: 'square', color: '#9b51e0', style: 'waves', hasFaceSlot: true,
    slots: [slot('headline', 'Headline', 'Meet Alex', 40, 'headline', true), slot('subline', 'Subline', 'Our favorite problem solver', 80, 'subline'), slot('cta', 'Call to action', 'Say hello', 24, 'cta'), slot('badge1', 'Badge 1', 'Since 2019', 20, 'badge')],
  },
  {
    key: 'starter-thank-you-story', title: 'Customer thank-you story', kind: 'photo', category: 'Greetings', tags: ['thanks', 'customers', 'community', 'story'],
    orientation: 'portrait', color: '#27ae60', style: 'sunburst', hasFaceSlot: true,
    slots: [slot('headline', 'Headline', 'Thank you', 40, 'headline', true), slot('subline', 'Subline', 'Because of you, this year was our best yet', 90, 'subline'), slot('cta', 'Call to action', 'See you soon', 24, 'cta'), slot('badge1', 'Badge 1', 'Community', 20, 'badge'), slot('badge2', 'Badge 2', 'Grateful', 20, 'badge')],
  },
  {
    key: 'starter-grand-opening', title: 'Grand opening weekend', kind: 'poster', category: 'Events', tags: ['opening', 'event', 'launch', 'celebration'],
    orientation: 'square', color: '#e0457b', style: 'mesh', hasFaceSlot: false,
    slots: [slot('headline', 'Headline', 'Grand opening weekend', 44, 'headline', true), slot('subline', 'Subline', 'Free treats for the first 100 guests', 80, 'subline'), slot('cta', 'Call to action', 'Join us Saturday', 24, 'cta'), slot('badge1', 'Badge 1', 'Live music', 20, 'badge'), slot('badge2', 'Badge 2', 'Free gifts', 20, 'badge'), slot('badge3', 'Badge 3', 'All welcome', 20, 'badge')],
  },
  {
    key: 'starter-weekend-sale', title: 'Weekend sale poster', kind: 'poster', category: 'Retail', tags: ['sale', 'discount', 'weekend', 'offer'],
    orientation: 'square', color: '#f2994a', style: 'stripes', hasFaceSlot: false,
    slots: [slot('headline', 'Headline', 'Weekend sale: 30% off', 44, 'headline', true), slot('subline', 'Subline', 'Two days only, in store and online', 80, 'subline'), slot('cta', 'Call to action', 'Shop the sale', 24, 'cta'), slot('badge1', 'Badge 1', 'Ends Sunday', 20, 'badge'), slot('badge2', 'Badge 2', 'Free returns', 20, 'badge')],
  },
  {
    key: 'starter-event-invite', title: 'You are invited', kind: 'poster', category: 'Events', tags: ['invitation', 'event', 'party', 'host'],
    orientation: 'portrait', color: '#2d9cdb', style: 'sunburst', hasFaceSlot: true,
    slots: [slot('headline', 'Headline', "You're invited", 40, 'headline', true), slot('subline', 'Subline', 'An evening of food, friends, and fun', 80, 'subline'), slot('cta', 'Call to action', 'RSVP today', 24, 'cta'), slot('badge1', 'Badge 1', 'Friday 7 pm', 20, 'badge'), slot('badge2', 'Badge 2', 'Downtown', 20, 'badge')],
  },
  {
    key: 'starter-hiring', title: 'We are hiring', kind: 'poster', category: 'Business', tags: ['hiring', 'jobs', 'careers', 'team'],
    orientation: 'portrait', color: '#00a6a6', style: 'waves', hasFaceSlot: true,
    slots: [slot('headline', 'Headline', "We're hiring", 40, 'headline', true), slot('subline', 'Subline', 'Join a friendly team that loves what it does', 80, 'subline'), slot('cta', 'Call to action', 'Apply today', 24, 'cta'), slot('badge1', 'Badge 1', 'Full time', 20, 'badge'), slot('badge2', 'Badge 2', 'Great perks', 20, 'badge')],
  },
  {
    key: 'starter-launch-reel', title: 'Product launch reel', kind: 'video', category: 'Retail', tags: ['launch', 'product', 'reel', 'promo'],
    orientation: 'portrait', durationSeconds: 8, color: '#e0457b', style: 'mesh', hasFaceSlot: false,
    motionPrompt: 'Slow cinematic push-in with soft light sweeping across the scene, gentle parallax and a premium commercial look.',
    slots: [slot('headline', 'Headline', 'Introducing the new one', 44, 'headline', true), slot('subline', 'Subline', 'Made for people who notice the details', 80, 'subline'), slot('cta', 'Call to action', 'Available now', 24, 'cta'), slot('badge1', 'Badge 1', 'Just launched', 20, 'badge')],
  },
  {
    key: 'starter-intro-reel', title: 'Introduce yourself reel', kind: 'video', category: 'People', tags: ['intro', 'personal brand', 'reel', 'people'],
    orientation: 'portrait', durationSeconds: 8, color: '#9b51e0', style: 'bokeh', hasFaceSlot: true,
    motionPrompt: 'The person smiles and gives a friendly nod toward the camera, subtle camera drift, warm soft light, natural movement.',
    slots: [slot('headline', 'Headline', "Hi, I'm Alex", 40, 'headline', true), slot('subline', 'Subline', 'Here is what I do and why I love it', 80, 'subline'), slot('cta', 'Call to action', 'Follow along', 24, 'cta'), slot('badge1', 'Badge 1', 'Hello', 20, 'badge')],
  },
  {
    key: 'starter-seasonal-promo', title: 'Seasonal promo video', kind: 'video', category: 'Retail', tags: ['seasonal', 'promo', 'offer', 'wide'],
    orientation: 'landscape', durationSeconds: 8, color: '#f2994a', style: 'stripes', hasFaceSlot: false,
    motionPrompt: 'Smooth camera slide across the scene with animated light flares and an upbeat commercial feel.',
    slots: [slot('headline', 'Headline', 'Seasonal favorites are back', 44, 'headline', true), slot('subline', 'Subline', 'Enjoy them while they last', 80, 'subline'), slot('cta', 'Call to action', 'Visit us today', 24, 'cta'), slot('badge1', 'Badge 1', 'Limited time', 20, 'badge'), slot('badge2', 'Badge 2', 'Fresh picks', 20, 'badge')],
  },
  {
    key: 'starter-flash-sale-reel', title: 'Flash sale countdown reel', kind: 'video', category: 'Retail', tags: ['flash sale', 'countdown', 'reel', 'discount'],
    orientation: 'portrait', durationSeconds: 4, color: '#eb5757', style: 'sunburst', hasFaceSlot: false,
    motionPrompt: 'Fast energetic zoom with pulsing light and bold dynamic energy, like a flash sale announcement.',
    slots: [slot('headline', 'Headline', 'Flash sale: 24 hours only', 44, 'headline', true), slot('subline', 'Subline', 'Biggest savings of the season', 80, 'subline'), slot('cta', 'Call to action', 'Grab yours', 24, 'cta'), slot('badge1', 'Badge 1', 'Today only', 20, 'badge')],
  },
]

export async function seedStarterTemplates(deps: Deps): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0
  for (const seed of STARTER_TEMPLATES) {
    const existing = await deps.prisma.template.findUnique({ where: { seedKey: seed.key } })
    if (existing) {
      skipped += 1
      continue
    }
    const fields = checkedShape(templateFieldsSchema.parse({
      title: seed.title,
      kind: seed.kind,
      category: seed.category,
      tags: seed.tags,
      orientation: seed.orientation,
      durationSeconds: seed.durationSeconds ?? null,
      textSlots: seed.slots,
      hasFaceSlot: seed.hasFaceSlot,
      motionPrompt: seed.motionPrompt ?? '',
      accentColor: seed.color,
    }))
    try {
      await createTemplateRow(deps, { organizationId: null, fields, status: 'published', seedKey: seed.key, artStyle: seed.style })
      created += 1
    } catch (error) {
      const raced = (error as { code?: string })?.code === 'P2002'
      if (!raced) throw error
      skipped += 1
    }
  }
  return { created, skipped }
}
