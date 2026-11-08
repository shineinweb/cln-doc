import { describe, expect, it } from 'vitest'
import { customerNav, navMatches } from './nav'

describe('customer nav', () => {
  it('includes Predis home and campaign pages', () => {
    const items = customerNav('OWNER', { scheduling: true, commentInbox: true, dmInbox: true })
    const paths = items.map((item) => item.to)
    expect(paths).toContain('/app')
    expect(paths).toContain('/app/auto-posting')
    expect(paths).toContain('/app/planner')
    expect(customerNav('OWNER', { scheduling: false, commentInbox: true, dmInbox: true }).map((item) => item.to)).not.toContain('/app/planner')
    expect(navMatches('/app/planner', '/app/calendar')).toBe(false)
    expect(paths).toContain('/app/templates')
    expect(customerNav('SUPPORT', { scheduling: true, commentInbox: true, dmInbox: true }).map((item) => item.to)).not.toContain('/app/templates')
    expect(paths).toContain('/app/library')
    expect(paths).toContain('/app/models')
    expect(paths).toContain('/app/campaigns')
    expect(navMatches('/app/campaigns/abc', '/app/campaigns')).toBe(true)
    expect(navMatches('/app/create', '/app')).toBe(false)
  })
})
