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
    { to: '/app', label: 'Home' },
    { to: '/app/create', label: 'Create' },
    { to: '/app/templates', label: 'Templates' },
    { to: '/app/ideas', label: 'Ideas' },
  ]
  if (entitlements.scheduling) {
    items.push({ to: '/app/calendar', label: 'Planner' }, { to: '/app/planner', label: 'AI Schedule' })
  }
  items.push(
    { to: '/app/auto-posting', label: 'Auto Posting' },
    { to: '/app/library', label: 'Content Library' },
    { to: '/app/campaigns', label: 'Campaigns' },
    { to: '/app/models', label: 'Model Studio' },
    { to: '/app/reports', label: 'Reports' },
    { to: '/app/links', label: 'Smart Links' },
    { to: '/app/ads', label: 'Ads' },
  )
  if (entitlements.commentInbox) items.push({ to: '/app/comments', label: 'Comments' })
  if (entitlements.dmInbox) items.push({ to: '/app/messages', label: 'Messages' })
  items.push({ to: '/app/insights', label: 'Insights' }, { to: '/app/settings', label: 'Settings' })
  return items
}

export function navMatches(pathname: string, to: string): boolean {
  if (to === '/app') return pathname === '/app'
  return pathname === to || pathname.startsWith(`${to}/`)
}
