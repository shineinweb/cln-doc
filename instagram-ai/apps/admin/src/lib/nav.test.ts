import { describe, expect, it } from 'vitest'
import { adminNav } from './nav'

describe('admin navigation', () => {
  it('hides site settings, SEO, and staff from Support', () => {
    const labels = adminNav('SUPPORT').map((item) => item.label)
    expect(labels).toEqual(['Dashboard', 'Organizations', 'Users', 'Packages', 'Subscriptions', 'Usage', 'Audit'])
    expect(adminNav('SUPER_ADMIN').map((item) => item.label)).toContain('Site settings')
    expect(adminNav('SUPER_ADMIN').map((item) => item.label)).toContain('SEO')
  })
})
