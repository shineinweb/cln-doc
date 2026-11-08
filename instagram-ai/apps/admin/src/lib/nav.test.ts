import { describe, expect, it } from 'vitest'
import { adminNav } from './nav'

describe('admin navigation', () => {
  it('lets Support open site settings and hides SEO and staff', () => {
    const labels = adminNav('SUPPORT').map((item) => item.label)
    expect(labels).toEqual(['Dashboard', 'Organizations', 'Users', 'Packages', 'Subscriptions', 'Usage', 'Templates', 'Site settings', 'Audit'])
    expect(adminNav('SUPER_ADMIN').map((item) => item.label)).toContain('Site settings')
    expect(adminNav('SUPER_ADMIN').map((item) => item.label)).toContain('SEO')
    expect(adminNav('SUPER_ADMIN').map((item) => item.label)).toContain('Templates')
  })
})
