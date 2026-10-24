import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isNoIndexPath } from '@instagram-ai/shared'
import { api, setClientSession } from '../lib/api'
import { customerNav, navMatches } from '../lib/nav'
import { applyPageSeo } from '../lib/seo'
import type { AccountInfo, PackageInfo } from '../lib/types'

export type SessionState = {
  user: { id: string; email: string; name: string }
  organization: { id: string; name: string }
  role: string
  package: PackageInfo
  subscriptionStatus: string
  maintenanceMessage: string
  accounts: AccountInfo[]
  refresh: () => Promise<void>
}

const SessionContext = createContext<SessionState | null>(null)

export function useSession(): SessionState {
  const value = useContext(SessionContext)
  if (!value) throw new Error('Missing session')
  return value
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionState | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  async function load() {
    const csrf = await api<{ csrfToken: string }>('/api/csrf')
    setClientSession({ csrfToken: csrf.csrfToken })
    const me = await api<{ user: SessionState['user']; organization: { id: string; name: string; role: string } }>('/api/auth/me')
    setClientSession({ organizationId: me.organization.id })
    const org = await api<{
      organization: { id: string; name: string }
      role: string
      package: PackageInfo
      subscription: { status: string }
      maintenanceMessage: string
    }>('/api/org')
    const accounts = await api<{ accounts: AccountInfo[] }>('/api/instagram/accounts')
    setSession({
      user: me.user,
      organization: org.organization,
      role: org.role,
      package: org.package,
      subscriptionStatus: org.subscription.status,
      maintenanceMessage: org.maintenanceMessage,
      accounts: accounts.accounts,
      refresh: load,
    })
  }

  useEffect(() => {
    load().catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    if (isNoIndexPath(location.pathname)) {
      applyPageSeo({ title: 'Workspace', description: 'Customer workspace', indexed: false })
    }
    setOpen(false)
  }, [location.pathname])

  if (failed) return <Navigate to="/login" replace />
  if (!session) return <main className="public-main">Loading workspace</main>

  const items = customerNav(session.role, session.package)
  const allowed = items.some((item) => navMatches(location.pathname, item.to))
  if (!allowed) return <Navigate to={items[0]?.to ?? '/app'} replace />
  const account = session.accounts.find((item) => item.status === 'connected') ?? session.accounts[0]

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' })
    navigate('/login')
  }

  return (
    <SessionContext.Provider value={session}>
      <div className="shell">
        <aside className={open ? 'sidebar open' : 'sidebar'}>
          <strong>Workspace</strong>
          {items.map((item) => (
            <Link className={navMatches(location.pathname, item.to) ? 'active' : ''} key={item.to} to={item.to}>{item.label}</Link>
          ))}
        </aside>
        <div className="workspace">
          {session.maintenanceMessage ? <div className="banner">{session.maintenanceMessage}</div> : null}
          <header className="topbar">
            <button className="menu-button" type="button" onClick={() => setOpen((value) => !value)}>Menu</button>
            <div>
              <strong>{session.organization.name}</strong>
              <div>{account ? `@${account.username}` : 'No Instagram account'}</div>
            </div>
            <div className="user-menu">
              <span>{session.user.name}</span>
              <button className="secondary" type="button" onClick={() => void logout()}>Log out</button>
            </div>
          </header>
          <main className="panel">
            <Outlet />
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  )
}
