import { describe, expect, it } from 'vitest'
import {
  canApprove,
  defaultPlanForm,
  fromLocalInput,
  groupByDay,
  hashtagText,
  mediaLabel,
  parseHashtagInput,
  planRequestBody,
  statusLabel,
  toLocalInput,
  toggle,
  validatePlanForm,
  type PlanPost,
} from './planner'

const NOW = new Date('2027-01-10T08:00:00.000Z')

function post(extra: Partial<PlanPost>): PlanPost {
  return {
    id: 'p',
    status: 'PENDING_APPROVAL',
    format: 'photo',
    description: 'Topic',
    caption: 'Caption',
    hashtags: [],
    scheduledAt: '2027-01-11T10:00:00.000Z',
    approvedAt: null,
    claimsNeedReview: false,
    publishError: null,
    mediaState: 'none',
    mediaError: null,
    media: [],
    ...extra,
  }
}

describe('plan form helpers', () => {
  it('starts tomorrow, on every day, with nothing chosen for the AI to guess', () => {
    const form = defaultPlanForm(NOW, 'UTC')
    expect(form.startDate).toBe('2027-01-11')
    expect(form.weekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(form.socialAccountIds).toEqual([])
    expect(form.range).toBe('week')
  })

  it('asks for the missing pieces and counts the posts when valid', () => {
    const form = defaultPlanForm(NOW, 'UTC')
    const empty = validatePlanForm(form, { timeZone: 'UTC', now: NOW })
    expect(empty.errors.join(' ')).toMatch(/account/)
    expect(empty.errors.join(' ')).toMatch(/goal/)
    const ready = validatePlanForm({ ...form, socialAccountIds: ['a'], goal: 'Spring menu' }, { timeZone: 'UTC', now: NOW })
    expect(ready.errors).toEqual([])
    expect(ready.slotCount).toBe(7)
    const tooMany = validatePlanForm({ ...form, range: 'month', postsPerDay: 3, socialAccountIds: ['a'], goal: 'Spring menu' }, { timeZone: 'UTC', now: NOW })
    expect(tooMany.errors.join(' ')).toMatch(/at most 31/)
  })

  it('builds the request body from the form text', () => {
    const body = planRequestBody({
      ...defaultPlanForm(NOW, 'UTC'),
      goal: ' Spring menu ',
      topics: 'Latte art\nBaristas; Latte art',
      socialAccountIds: ['a'],
      campaignId: '',
    })
    expect(body.goal).toBe('Spring menu')
    expect(body.topics).toEqual(['Latte art', 'Baristas'])
    expect(body.campaignId).toBeNull()
  })

  it('toggles list entries without repeats', () => {
    expect(toggle([1, 2], 3, true)).toEqual([1, 2, 3])
    expect(toggle([1, 2, 2], 2, true)).toEqual([1, 2])
    expect(toggle([1, 2], 1, false)).toEqual([2])
  })
})

describe('plan review helpers', () => {
  it('shows and edits times in the account time zone', () => {
    expect(toLocalInput('2027-01-15T15:00:00.000Z', 'America/New_York')).toBe('2027-01-15T10:00')
    expect(fromLocalInput('2027-01-15T10:00', 'America/New_York')).toBe('2027-01-15T15:00:00.000Z')
    expect(fromLocalInput('', 'UTC')).toBeNull()
    expect(toLocalInput(null, 'UTC')).toBe('')
  })

  it('groups posts by local day in time order', () => {
    const groups = groupByDay([
      post({ id: 'c', scheduledAt: '2027-01-12T09:00:00.000Z' }),
      post({ id: 'b', scheduledAt: '2027-01-11T17:00:00.000Z' }),
      post({ id: 'a', scheduledAt: '2027-01-11T10:00:00.000Z' }),
    ], 'UTC')
    expect(groups.map((group) => group.day)).toEqual(['2027-01-11', '2027-01-12'])
    expect(groups[0].posts.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('labels status and media and only lets waiting posts be approved', () => {
    expect(statusLabel(post({}))).toBe('Needs your approval')
    expect(statusLabel(post({ status: 'SCHEDULED' }))).toBe('Approved and scheduled')
    expect(mediaLabel(post({ mediaState: 'generating' }))).toBe('Media generating')
    expect(canApprove(post({}))).toBe(true)
    expect(canApprove(post({ status: 'SCHEDULED' }))).toBe(false)
    expect(canApprove(post({ status: 'PUBLISHED' }))).toBe(false)
  })

  it('reads and writes hashtags', () => {
    expect(parseHashtagInput('#latte, coffee  #Latte')).toEqual([{ tag: 'latte', enabled: true }, { tag: 'coffee', enabled: true }])
    expect(hashtagText([{ tag: 'latte', enabled: true }, { tag: 'off', enabled: false }])).toBe('#latte')
  })
})
