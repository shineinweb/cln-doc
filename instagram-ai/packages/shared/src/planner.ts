import { POST_FORMATS, storedAudienceHours, zonedDay, type AudienceHour, type PostFormat } from './index'

export const PLAN_RANGES = ['day', 'week', 'month'] as const
export type PlanRange = (typeof PLAN_RANGES)[number]

export const PLAN_MAX_POSTS = 31
export const PLAN_MAX_PER_DAY = 3
export const PLAN_ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const
export const PLAN_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type PlanInputs = {
  range: PlanRange
  startDate: string
  postsPerDay: number
  weekdays: number[]
  formats: PostFormat[]
  socialAccountIds: string[]
  goal: string
  topics: string[]
  promotions: string
  tone: string
  language: string
  useBestTimes: boolean
  campaignId: string | null
}

export type PlanSlot = {
  index: number
  day: string
  hour: number
  minute: number
  scheduledAt: Date
  format: PostFormat
}

const DEFAULT_HOURS: Record<number, number[]> = {
  1: [10],
  2: [10, 17],
  3: [9, 13, 18],
}

export function isPlanDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function addPlanDays(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + amount))
  return next.toISOString().slice(0, 10)
}

export function planWeekday(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay()
}

export function planEndDay(range: PlanRange, startDate: string): string {
  if (range === 'day') return startDate
  if (range === 'week') return addPlanDays(startDate, 6)
  const [year, month, date] = startDate.split('-').map(Number)
  const lastOfNext = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const nextMonth = new Date(Date.UTC(year, month, Math.min(date, lastOfNext)))
  return addPlanDays(nextMonth.toISOString().slice(0, 10), -1)
}

function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'))
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000)
}

export function zonedTimeToUtc(day: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, date, hour, minute)
  let guess = wall - offsetMinutes(timeZone, new Date(wall)) * 60000
  guess = wall - offsetMinutes(timeZone, new Date(guess)) * 60000
  return new Date(guess)
}

export function postingHours(perDay: number, useBestTimes: boolean, audience: AudienceHour[] = []): number[] {
  const count = Math.min(Math.max(Math.floor(perDay), 1), PLAN_MAX_PER_DAY)
  const defaults = DEFAULT_HOURS[count]
  if (!useBestTimes) return defaults
  const best = storedAudienceHours({ hours: audience }).slice(0, count).map((item) => item.hour)
  if (!best.length) return defaults
  const filled = [...best]
  for (const hour of [...DEFAULT_HOURS[3], 10, 17]) {
    if (filled.length >= count) break
    if (!filled.includes(hour)) filled.push(hour)
  }
  return filled.sort((a, b) => a - b)
}

export function planDays(inputs: Pick<PlanInputs, 'range' | 'startDate' | 'weekdays'>): string[] {
  if (!isPlanDay(inputs.startDate)) return []
  const end = planEndDay(inputs.range, inputs.startDate)
  const days: string[] = []
  for (let day = inputs.startDate; day <= end; day = addPlanDays(day, 1)) {
    if (inputs.weekdays.includes(planWeekday(day))) days.push(day)
  }
  return days
}

export type SlotOptions = { timeZone: string; now?: Date; audience?: AudienceHour[] }

export function buildPlanSlots(inputs: PlanInputs, options: SlotOptions): PlanSlot[] {
  const now = options.now ?? new Date()
  const hours = postingHours(inputs.postsPerDay, inputs.useBestTimes, options.audience)
  const formats = inputs.formats.length ? inputs.formats : (['photo'] as PostFormat[])
  const slots: PlanSlot[] = []
  for (const day of planDays(inputs)) {
    for (const hour of hours) {
      const scheduledAt = zonedTimeToUtc(day, hour, 0, options.timeZone)
      if (scheduledAt.getTime() <= now.getTime()) continue
      slots.push({ index: slots.length, day, hour, minute: 0, scheduledAt, format: formats[slots.length % formats.length] })
    }
  }
  return slots
}

export type PlanDraftInput = {
  range?: unknown
  startDate?: unknown
  postsPerDay?: unknown
  weekdays?: unknown
  formats?: unknown
  socialAccountIds?: unknown
  goal?: unknown
  topics?: unknown
  promotions?: unknown
  tone?: unknown
  language?: unknown
  useBestTimes?: unknown
  campaignId?: unknown
}

export function splitTopics(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/\r?\n|;/)) {
    const topic = part.replace(/\s+/g, ' ').trim()
    if (!topic || seen.has(topic.toLowerCase())) continue
    seen.add(topic.toLowerCase())
    out.push(topic)
  }
  return out.slice(0, 20)
}

export function validatePlanDraft(draft: PlanDraftInput, options: SlotOptions): { errors: string[]; slotCount: number } {
  const errors: string[] = []
  const now = options.now ?? new Date()
  const range = draft.range
  if (typeof range !== 'string' || !(PLAN_RANGES as readonly string[]).includes(range)) errors.push('Choose Day, Week, or Month')
  const start = typeof draft.startDate === 'string' ? draft.startDate : ''
  if (!isPlanDay(start)) errors.push('Choose a start date')
  else if (start < zonedDay(now.toISOString(), options.timeZone)) errors.push('The start date cannot be in the past')
  const perDay = Number(draft.postsPerDay)
  if (!Number.isInteger(perDay) || perDay < 1 || perDay > PLAN_MAX_PER_DAY) errors.push(`Posts per day must be 1 to ${PLAN_MAX_PER_DAY}`)
  const weekdays = Array.isArray(draft.weekdays) ? draft.weekdays : []
  if (!weekdays.length || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) errors.push('Pick at least one day to post on')
  const formats = Array.isArray(draft.formats) ? draft.formats : []
  if (!formats.length || formats.some((item) => !(POST_FORMATS as readonly string[]).includes(String(item)))) errors.push('Pick at least one format')
  const accounts = Array.isArray(draft.socialAccountIds) ? draft.socialAccountIds : []
  if (!accounts.length) errors.push('Choose at least one account to post to')
  if (typeof draft.goal !== 'string' || draft.goal.trim().length < 3) errors.push('Describe the goal or theme in a few words')
  if (errors.length) return { errors, slotCount: 0 }
  const inputs: PlanInputs = {
    range: range as PlanRange,
    startDate: start,
    postsPerDay: perDay,
    weekdays: weekdays as number[],
    formats: formats as PostFormat[],
    socialAccountIds: accounts as string[],
    goal: String(draft.goal),
    topics: [],
    promotions: '',
    tone: '',
    language: '',
    useBestTimes: draft.useBestTimes === true,
    campaignId: null,
  }
  const slotCount = buildPlanSlots(inputs, options).length
  if (slotCount === 0) errors.push('No posting times are left in that range. Pick a later start date or more days')
  if (slotCount > PLAN_MAX_POSTS) errors.push(`This would create ${slotCount} posts and a plan can hold at most ${PLAN_MAX_POSTS}. Post less often or pick fewer days`)
  return { errors, slotCount }
}
