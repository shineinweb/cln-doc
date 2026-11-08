import { describe, expect, it } from 'vitest'
import {
  PLAN_MAX_POSTS,
  buildPlanSlots,
  planDays,
  planEndDay,
  postingHours,
  splitTopics,
  validatePlanDraft,
  zonedTimeToUtc,
  type PlanInputs,
} from './planner'

const NOW = new Date('2027-01-10T08:00:00.000Z')

function inputs(extra: Partial<PlanInputs> = {}): PlanInputs {
  return {
    range: 'week',
    startDate: '2027-01-11',
    postsPerDay: 1,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    formats: ['photo', 'reel'],
    socialAccountIds: ['a'],
    goal: 'Spring menu',
    topics: [],
    promotions: '',
    tone: '',
    language: '',
    useBestTimes: false,
    campaignId: null,
    ...extra,
  }
}

describe('plan date and time math', () => {
  it('ends a day, week and month plan on the right day', () => {
    expect(planEndDay('day', '2027-01-11')).toBe('2027-01-11')
    expect(planEndDay('week', '2027-01-11')).toBe('2027-01-17')
    expect(planEndDay('month', '2027-01-15')).toBe('2027-02-14')
    expect(planEndDay('month', '2027-01-31')).toBe('2027-02-27')
    expect(planEndDay('month', '2027-12-01')).toBe('2027-12-31')
  })

  it('lists only the chosen weekdays', () => {
    expect(planDays(inputs({ weekdays: [1, 3] }))).toEqual(['2027-01-11', '2027-01-13'])
    expect(planDays(inputs({ range: 'day', startDate: '2027-01-11', weekdays: [2] }))).toEqual([])
  })

  it('turns local posting times into UTC for the account time zone, including daylight saving', () => {
    expect(zonedTimeToUtc('2027-01-15', 10, 0, 'UTC').toISOString()).toBe('2027-01-15T10:00:00.000Z')
    expect(zonedTimeToUtc('2027-01-15', 10, 0, 'America/New_York').toISOString()).toBe('2027-01-15T15:00:00.000Z')
    expect(zonedTimeToUtc('2027-07-15', 10, 0, 'America/New_York').toISOString()).toBe('2027-07-15T14:00:00.000Z')
    expect(zonedTimeToUtc('2027-01-15', 10, 0, 'Asia/Kolkata').toISOString()).toBe('2027-01-15T04:30:00.000Z')
    expect(zonedTimeToUtc('2027-01-15', 10, 0, 'Pacific/Auckland').toISOString()).toBe('2027-01-14T21:00:00.000Z')
  })

  it('builds one slot per post per day and rotates formats', () => {
    const slots = buildPlanSlots(inputs({ postsPerDay: 2 }), { timeZone: 'UTC', now: NOW })
    expect(slots).toHaveLength(14)
    expect(slots.slice(0, 4).map((slot) => slot.scheduledAt.toISOString())).toEqual([
      '2027-01-11T10:00:00.000Z',
      '2027-01-11T17:00:00.000Z',
      '2027-01-12T10:00:00.000Z',
      '2027-01-12T17:00:00.000Z',
    ])
    expect(slots.slice(0, 4).map((slot) => slot.format)).toEqual(['photo', 'reel', 'photo', 'reel'])
    expect(slots.map((slot) => slot.index)).toEqual(slots.map((_, i) => i))
  })

  it('drops times that have already passed today', () => {
    const slots = buildPlanSlots(inputs({ range: 'day', startDate: '2027-01-10', postsPerDay: 3 }), {
      timeZone: 'UTC',
      now: new Date('2027-01-10T10:30:00.000Z'),
    })
    expect(slots.map((slot) => slot.hour)).toEqual([13, 18])
  })

  it('uses the top audience hours only when asked, and fills with defaults', () => {
    const audience = [{ hour: 20, value: 90 }, { hour: 7, value: 40 }, { hour: 12, value: 10 }]
    expect(postingHours(2, false, audience)).toEqual([10, 17])
    expect(postingHours(2, true, audience)).toEqual([7, 20])
    expect(postingHours(2, true, [])).toEqual([10, 17])
    expect(postingHours(3, true, [{ hour: 9, value: 5 }])).toEqual([9, 13, 18])
  })
})

describe('plan validation', () => {
  const options = { timeZone: 'UTC', now: NOW }

  it('accepts a good plan and counts its posts', () => {
    const result = validatePlanDraft(inputs(), options)
    expect(result.errors).toEqual([])
    expect(result.slotCount).toBe(7)
  })

  it('names each problem in plain words', () => {
    expect(validatePlanDraft(inputs({ startDate: '2027-01-01' }), options).errors.join(' ')).toMatch(/past/)
    expect(validatePlanDraft(inputs({ startDate: '' }), options).errors.join(' ')).toMatch(/start date/)
    expect(validatePlanDraft(inputs({ postsPerDay: 4 }), options).errors.join(' ')).toMatch(/1 to 3/)
    expect(validatePlanDraft(inputs({ weekdays: [] }), options).errors.join(' ')).toMatch(/day to post/)
    expect(validatePlanDraft(inputs({ formats: [] }), options).errors.join(' ')).toMatch(/format/)
    expect(validatePlanDraft(inputs({ socialAccountIds: [] }), options).errors.join(' ')).toMatch(/account/)
    expect(validatePlanDraft(inputs({ goal: ' ' }), options).errors.join(' ')).toMatch(/goal/)
  })

  it(`refuses more than ${PLAN_MAX_POSTS} posts`, () => {
    const result = validatePlanDraft(inputs({ range: 'month', postsPerDay: 3 }), options)
    expect(result.errors.join(' ')).toMatch(/at most 31/)
    expect(validatePlanDraft(inputs({ range: 'month', postsPerDay: 1 }), options).errors).toEqual([])
  })

  it('splits topics by line or semicolon and removes repeats', () => {
    expect(splitTopics('New menu\nNew menu; Staff spotlight \n\n')).toEqual(['New menu', 'Staff spotlight'])
  })
})
