export type NavItem = { to: string; label: string }

export type NavEntitlements = {
  scheduling: boolean
  commentInbox: boolean
  dmInbox: boolean
}

export function customerNav(role: string, entitlements: NavEntitlements): NavItem[] {
  if (role === 'SUPPORT') {
    return [
      { to: '/app/comments', label: 'Comments' },
      { to: '/app/messages', label: 'Messages' },
    ]
  }
  const items: NavItem[] = [
    { to: '/app', label: 'Dashboard' },
    { to: '/app/create', label: 'Create' },
  ]
  if (entitlements.scheduling) items.push({ to: '/app/calendar', label: 'Calendar' })
  if (entitlements.commentInbox) items.push({ to: '/app/comments', label: 'Comments' })
  if (entitlements.dmInbox) items.push({ to: '/app/messages', label: 'Messages' })
  items.push({ to: '/app/insights', label: 'Insights' }, { to: '/app/settings', label: 'Settings' })
  return items
}

export function navMatches(pathname: string, to: string): boolean {
  if (to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(`${to}/`)
}
