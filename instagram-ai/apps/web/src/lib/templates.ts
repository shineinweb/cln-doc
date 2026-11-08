export type SlotPosition = 'headline' | 'subline' | 'cta' | 'badge'

export type TemplateSlot = {
  key: string
  label: string
  default: string
  maxLength: number
  position: SlotPosition
  required: boolean
}

export type TemplateCardData = {
  id: string
  title: string
  kind: 'photo' | 'poster' | 'video'
  category: string
  tags: string[]
  orientation: 'square' | 'portrait' | 'landscape'
  durationSeconds: number | null
  format: 'photo' | 'story' | 'reel' | 'video'
  textSlots: TemplateSlot[]
  hasFaceSlot: boolean
  motionPrompt: string
  status: string
  useCount: number
  platform: boolean
  mine: boolean
  thumbnailUrl: string | null
  sourceUrl: string | null
}

export type FacePhoto = { id: string; url: string; filename: string; createdAt: string; deleteAfter: string | null }

export const TEMPLATE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'recent', label: 'Recently used' },
] as const
export type TemplateTab = (typeof TEMPLATE_TABS)[number]['id']

export const TEMPLATE_SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Most used' },
  { id: 'name', label: 'Name A-Z' },
] as const

export type GalleryFilters = {
  tab: TemplateTab
  q: string
  sort: string
  kind: string
  orientation: string
  category: string
}

export const EMPTY_FILTERS: GalleryFilters = { tab: 'all', q: '', sort: 'newest', kind: '', orientation: '', category: '' }

export function galleryQuery(filters: GalleryFilters, page: number): string {
  const params = new URLSearchParams()
  if (filters.tab !== 'all') params.set('tab', filters.tab)
  if (filters.q.trim()) params.set('q', filters.q.trim())
  params.set('sort', filters.sort)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.orientation) params.set('orientation', filters.orientation)
  if (filters.category) params.set('category', filters.category)
  params.set('page', String(page))
  return params.toString()
}

export function startingValues(slots: TemplateSlot[]): Record<string, string> {
  return Object.fromEntries(slots.map((slot) => [slot.key, slot.default]))
}

export function slotIssues(slots: TemplateSlot[], values: Record<string, string>): Record<string, string> {
  const issues: Record<string, string> = {}
  for (const slot of slots) {
    const value = (values[slot.key] ?? '').trim()
    if (slot.required && !value) issues[slot.key] = `${slot.label} is required`
    else if (value.length > slot.maxLength) issues[slot.key] = `${slot.label} can be at most ${slot.maxLength} characters`
  }
  return issues
}

export const CONSENT_LABEL = 'This is my face, or I have the person’s permission.'
export const FACE_TERMS = 'Only use your own face or a face you have permission to use. No public figures, no minors, and nothing misleading. Face photos you upload are deleted after 30 days, or sooner when you delete them.'

export function generateBlocker(input: {
  slots: TemplateSlot[]
  values: Record<string, string>
  faceId: string | null
  consent: boolean
  canWrite: boolean
}): string | null {
  if (!input.canWrite) return 'Your role can browse templates but cannot create drafts.'
  const issues = Object.values(slotIssues(input.slots, input.values))
  if (issues.length) return issues[0] as string
  if (input.faceId && !input.consent) return 'Confirm that this is your face, or that you have the person’s permission.'
  return null
}

export function kindLabel(card: Pick<TemplateCardData, 'kind' | 'durationSeconds'>): string {
  const base = card.kind === 'photo' ? 'Photo' : card.kind === 'poster' ? 'Poster' : 'Video'
  return card.durationSeconds ? `${base} · ${card.durationSeconds}s` : base
}

export function templateKindFor(format: string): 'photo' | 'video' {
  return format === 'reel' || format === 'video' ? 'video' : 'photo'
}

export function orientationFor(format: string): 'square' | 'portrait' | 'landscape' {
  if (format === 'story' || format === 'reel') return 'portrait'
  if (format === 'video') return 'landscape'
  return 'square'
}

export function slotsFromPost(post: { description: string; callToAction: string | null }): TemplateSlot[] {
  const lines = post.description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`)
  const slots: TemplateSlot[] = [
    { key: 'headline', label: 'Headline', default: clip(lines[0] ?? 'Your headline', 44), maxLength: 44, position: 'headline', required: true },
  ]
  if (lines[1]) slots.push({ key: 'subline', label: 'Subline', default: clip(lines[1], 80), maxLength: 80, position: 'subline', required: false })
  if (post.callToAction?.trim()) slots.push({ key: 'cta', label: 'Call to action', default: clip(post.callToAction.trim(), 24), maxLength: 24, position: 'cta', required: false })
  return slots
}
