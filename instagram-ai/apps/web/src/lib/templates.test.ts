import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, galleryQuery, generateBlocker, orientationFor, slotIssues, slotsFromPost, startingValues, templateKindFor, type TemplateSlot } from './templates'

const slots: TemplateSlot[] = [
  { key: 'headline', label: 'Headline', default: 'Fresh', maxLength: 10, position: 'headline', required: true },
  { key: 'cta', label: 'Call to action', default: '', maxLength: 8, position: 'cta', required: false },
]

describe('template helpers', () => {
  it('builds the gallery query with paging and only the filters in use', () => {
    expect(galleryQuery(EMPTY_FILTERS, 1)).toBe('sort=newest&page=1')
    expect(galleryQuery({ ...EMPTY_FILTERS, tab: 'mine', q: ' sale ', sort: 'popular', kind: 'video', orientation: 'portrait', category: 'Food' }, 3))
      .toBe('tab=mine&q=sale&sort=popular&kind=video&orientation=portrait&category=Food&page=3')
  })

  it('checks required and too long text', () => {
    expect(slotIssues(slots, startingValues(slots))).toEqual({})
    expect(slotIssues(slots, { headline: '  ', cta: 'x' }).headline).toMatch(/required/)
    expect(slotIssues(slots, { headline: 'Fresh', cta: 'way too long' }).cta).toMatch(/at most 8/)
  })

  it('needs consent before a face is used and a writable role', () => {
    const values = { headline: 'Fresh', cta: '' }
    expect(generateBlocker({ slots, values, faceId: null, consent: false, canWrite: true })).toBeNull()
    expect(generateBlocker({ slots, values, faceId: 'f1', consent: false, canWrite: true })).toMatch(/permission/)
    expect(generateBlocker({ slots, values, faceId: 'f1', consent: true, canWrite: true })).toBeNull()
    expect(generateBlocker({ slots, values, faceId: null, consent: false, canWrite: false })).toMatch(/browse/)
  })

  it('maps a post to a template shape and text slots', () => {
    expect(templateKindFor('reel')).toBe('video')
    expect(templateKindFor('story')).toBe('photo')
    expect(orientationFor('story')).toBe('portrait')
    expect(orientationFor('video')).toBe('landscape')
    expect(orientationFor('photo')).toBe('square')
    const made = slotsFromPost({ description: `${'A'.repeat(60)}\nSecond line`, callToAction: 'Book a table today please' })
    expect(made.map((slot) => slot.key)).toEqual(['headline', 'subline', 'cta'])
    expect(made[0]?.default.length).toBeLessThanOrEqual(44)
    expect(made[2]?.default.length).toBeLessThanOrEqual(24)
  })
})
