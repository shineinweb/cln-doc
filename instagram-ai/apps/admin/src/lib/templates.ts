export const SLOT_POSITIONS = ['headline', 'subline', 'cta', 'badge'] as const
export type SlotPosition = (typeof SLOT_POSITIONS)[number]

export type Slot = {
  key: string
  label: string
  default: string
  maxLength: number
  position: SlotPosition
  required: boolean
}

export type TemplateRow = {
  id: string
  title: string
  kind: 'photo' | 'poster' | 'video'
  category: string
  tags: string[]
  orientation: 'square' | 'portrait' | 'landscape'
  durationSeconds: number | null
  textSlots: Slot[]
  hasFaceSlot: boolean
  motionPrompt: string
  accentColor: string | null
  status: 'draft' | 'published'
  useCount: number
  thumbnailUrl: string | null
  sourceUrl: string | null
}

export const DEFAULT_SLOTS: Slot[] = [
  { key: 'headline', label: 'Headline', default: 'Your headline', maxLength: 44, position: 'headline', required: true },
  { key: 'subline', label: 'Subline', default: 'A short supporting line', maxLength: 80, position: 'subline', required: false },
  { key: 'cta', label: 'Call to action', default: 'Learn more', maxLength: 24, position: 'cta', required: false },
]

export function newSlot(existing: Slot[]): Slot {
  const taken = new Set(existing.map((slot) => slot.key))
  let n = existing.length + 1
  while (taken.has(`badge${n}`)) n += 1
  return { key: `badge${n}`, label: `Badge ${n}`, default: '', maxLength: 20, position: 'badge', required: false }
}

export function lengthsFor(kind: string, orientation: string): number[] {
  if (kind !== 'video') return []
  return orientation === 'portrait' ? [4, 8, 12] : [8, 15, 30]
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, 8)
}

export function slotProblem(slots: Slot[]): string | null {
  if (!slots.length) return 'Add at least one text slot.'
  const keys = new Set<string>()
  const counts: Record<string, number> = {}
  for (const slot of slots) {
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(slot.key)) return `The key "${slot.key}" can only use lowercase letters, numbers, and underscores.`
    if (keys.has(slot.key)) return `The key "${slot.key}" is used twice.`
    keys.add(slot.key)
    if (!slot.label.trim()) return 'Every text slot needs a label.'
    if (slot.default.length > slot.maxLength) return `The default for "${slot.label}" is longer than its limit.`
    counts[slot.position] = (counts[slot.position] ?? 0) + 1
  }
  for (const position of ['headline', 'subline', 'cta'] as const) {
    if ((counts[position] ?? 0) > 1) return `Only one ${position} slot is allowed.`
  }
  if ((counts.badge ?? 0) > 3) return 'At most 3 badge slots are allowed.'
  if (!counts.headline) return 'A template needs a headline slot.'
  return null
}

export function faceSwitchNotice(enabled: boolean): string {
  return enabled
    ? 'Face personalization is on. Customers can add a face photo to a template.'
    : 'Face personalization is off. Customers can still edit template text, but cannot add a face photo.'
}

export function templateQuery(filters: { q: string; sort: string; kind: string; status: string; orientation: string }, page: number): string {
  const params = new URLSearchParams()
  if (filters.q.trim()) params.set('q', filters.q.trim())
  params.set('sort', filters.sort)
  if (filters.kind) params.set('kind', filters.kind)
  if (filters.status) params.set('status', filters.status)
  if (filters.orientation) params.set('orientation', filters.orientation)
  params.set('page', String(page))
  return params.toString()
}
