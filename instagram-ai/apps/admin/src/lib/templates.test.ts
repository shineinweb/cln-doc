import { describe, expect, it } from 'vitest'
import { DEFAULT_SLOTS, faceSwitchNotice, lengthsFor, newSlot, parseTags, slotProblem, templateQuery } from './templates'

describe('template admin helpers', () => {
  it('accepts the default slots and flags the same problems the server does', () => {
    expect(slotProblem(DEFAULT_SLOTS)).toBeNull()
    expect(slotProblem([])).toMatch(/at least one/)
    expect(slotProblem([{ ...DEFAULT_SLOTS[1]! }])).toMatch(/headline slot/)
    expect(slotProblem([DEFAULT_SLOTS[0]!, { ...DEFAULT_SLOTS[0]!, position: 'subline' }])).toMatch(/used twice/)
    expect(slotProblem([DEFAULT_SLOTS[0]!, { ...DEFAULT_SLOTS[1]!, key: 'Bad Key' }])).toMatch(/lowercase/)
    expect(slotProblem([{ ...DEFAULT_SLOTS[0]!, default: 'x'.repeat(50), maxLength: 10 }])).toMatch(/longer than its limit/)
    const badges = [DEFAULT_SLOTS[0]!]
    for (let i = 0; i < 4; i += 1) badges.push(newSlot(badges))
    expect(slotProblem(badges)).toMatch(/At most 3 badge/)
  })

  it('offers the real video lengths and builds the list query', () => {
    expect(lengthsFor('video', 'portrait')).toEqual([4, 8, 12])
    expect(lengthsFor('video', 'landscape')).toEqual([8, 15, 30])
    expect(lengthsFor('photo', 'square')).toEqual([])
    expect(parseTags(' sale, Sale ,, new ')).toEqual(['sale', 'Sale', 'new'])
    expect(templateQuery({ q: ' cafe ', sort: 'popular', kind: 'video', status: '', orientation: '' }, 3)).toBe('q=cafe&sort=popular&kind=video&page=3')
    expect(faceSwitchNotice(false)).toContain('cannot add a face photo')
  })
})
