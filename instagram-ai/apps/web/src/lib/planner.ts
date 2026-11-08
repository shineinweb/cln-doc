import {
  PLAN_ALL_DAYS,
  addPlanDays,
  splitTopics,
  validatePlanDraft,
  zonedDay,
  zonedTimeToUtc,
  type AudienceHour,
  type HashtagChip,
  type PlanRange,
  type PostFormat,
} from '@instagram-ai/shared'

export type PlanFormState = {
  range: PlanRange
  startDate: string
  postsPerDay: number
  weekdays: number[]
  formats: PostFormat[]
  socialAccountIds: string[]
  goal: string
  topics: string
  promotions: string
  tone: string
  language: string
  useBestTimes: boolean
  campaignId: string
}

export type PlanCounts = { total: number; pending: number; scheduled: number; published: number; failed: number }

export type PlanRecord = {
  id: string
  range: PlanRange
  startsAt: string
  endsAt: string
  status: string
  campaignId: string | null
  counts: PlanCounts
  createdAt: string
  inputs: { goal: string; postsPerDay: number; formats: string[]; socialAccountIds: string[] }
}

export type PlanPost = {
  id: string
  status: string
  format: string
  description: string
  caption: string
  hashtags: HashtagChip[]
  scheduledAt: string | null
  approvedAt: string | null
  claimsNeedReview: boolean
  publishError: string | null
  socialAccountIds?: string[]
  mediaState: 'ready' | 'generating' | 'failed' | 'none'
  mediaError: string | null
  media: Array<{ id: string; url: string; mimeType: string }>
}

export type PostPatch = {
  caption?: string
  description?: string
  hashtags?: HashtagChip[]
  scheduledAt?: string
  format?: PostFormat
}

export function localDay(now: Date, timeZone: string): string {
  return zonedDay(now.toISOString(), timeZone)
}

export function defaultPlanForm(now: Date, timeZone: string): PlanFormState {
  return {
    range: 'week',
    startDate: addPlanDays(localDay(now, timeZone), 1),
    postsPerDay: 1,
    weekdays: [...PLAN_ALL_DAYS],
    formats: ['photo'],
    socialAccountIds: [],
    goal: '',
    topics: '',
    promotions: '',
    tone: '',
    language: '',
    useBestTimes: false,
    campaignId: '',
  }
}

export function validatePlanForm(form: PlanFormState, options: { timeZone: string; now?: Date; audience?: AudienceHour[] }) {
  return validatePlanDraft(
    {
      range: form.range,
      startDate: form.startDate,
      postsPerDay: form.postsPerDay,
      weekdays: form.weekdays,
      formats: form.formats,
      socialAccountIds: form.socialAccountIds,
      goal: form.goal,
      useBestTimes: form.useBestTimes,
    },
    options,
  )
}

export function planRequestBody(form: PlanFormState) {
  return {
    range: form.range,
    startDate: form.startDate,
    postsPerDay: form.postsPerDay,
    weekdays: [...form.weekdays].sort(),
    formats: form.formats,
    socialAccountIds: form.socialAccountIds,
    goal: form.goal.trim(),
    topics: splitTopics(form.topics),
    promotions: form.promotions.trim(),
    tone: form.tone.trim(),
    language: form.language.trim(),
    useBestTimes: form.useBestTimes,
    campaignId: form.campaignId || null,
  }
}

export function toggle<T>(list: T[], item: T, on: boolean): T[] {
  const without = list.filter((entry) => entry !== item)
  return on ? [...without, item] : without
}

export function toLocalInput(iso: string | null, timeZone: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(date)
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00'
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00'
  return `${zonedDay(iso, timeZone)}T${hour}:${minute}`
}

export function fromLocalInput(value: string, timeZone: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null
  return zonedTimeToUtc(match[1], Number(match[2]), Number(match[3]), timeZone).toISOString()
}

export function formatSlot(iso: string | null, timeZone: string): string {
  if (!iso) return 'No time set'
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

export function groupByDay(posts: PlanPost[], timeZone: string): Array<{ day: string; posts: PlanPost[] }> {
  const days = new Map<string, PlanPost[]>()
  for (const post of posts) {
    if (!post.scheduledAt) continue
    const day = zonedDay(post.scheduledAt, timeZone)
    days.set(day, [...(days.get(day) ?? []), post])
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, items]) => ({ day, posts: items.sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')) }))
}

export function statusLabel(post: Pick<PlanPost, 'status' | 'approvedAt'>): string {
  if (post.status === 'SCHEDULED') return 'Approved and scheduled'
  if (post.status === 'PUBLISHING') return 'Publishing'
  if (post.status === 'PUBLISHED') return 'Published'
  if (post.status === 'FAILED') return 'Failed'
  if (post.status === 'CANCELED') return 'Canceled'
  return 'Needs your approval'
}

export function mediaLabel(post: Pick<PlanPost, 'mediaState'>): string {
  if (post.mediaState === 'ready') return 'Media ready'
  if (post.mediaState === 'generating') return 'Media generating'
  if (post.mediaState === 'failed') return 'Media failed'
  return 'No media yet'
}

export function canApprove(post: Pick<PlanPost, 'status'>): boolean {
  return post.status === 'DRAFT' || post.status === 'PENDING_APPROVAL'
}

export function isLocked(post: Pick<PlanPost, 'status'>): boolean {
  return post.status === 'PUBLISHED' || post.status === 'PUBLISHING'
}

export function parseHashtagInput(text: string): HashtagChip[] {
  const seen = new Set<string>()
  const chips: HashtagChip[] = []
  for (const raw of text.split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, '').trim()
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    chips.push({ tag, enabled: true })
  }
  return chips
}

export function hashtagText(chips: HashtagChip[]): string {
  return chips.filter((chip) => chip.enabled).map((chip) => `#${chip.tag}`).join(' ')
}
