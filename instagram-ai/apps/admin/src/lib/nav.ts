export type NavItem = { to: string; label: string }

export const ADMIN_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/organizations', label: 'Organizations' },
  { to: '/users', label: 'Users' },
  { to: '/packages', label: 'Packages' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/usage', label: 'Usage' },
  { to: '/settings', label: 'Site settings' },
  { to: '/seo', label: 'SEO' },
  { to: '/audit', label: 'Audit' },
  { to: '/staff', label: 'Staff' },
]

const SUPPORT_HIDDEN = new Set(['Site settings', 'SEO', 'Staff'])

export function adminNav(role: string): NavItem[] {
  if (role === 'SUPPORT') return ADMIN_NAV.filter((item) => !SUPPORT_HIDDEN.has(item.label))
  return ADMIN_NAV
}
