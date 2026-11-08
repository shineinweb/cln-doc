import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { api, setCsrf } from './lib/api'
import { Hint, Pager, confirmDelete } from './lib/form'
import { PROVIDER_TOGGLES, isOn, providerStatusLine, toggleNotice, type ProviderFlags, type ProviderToggleField } from './lib/providers'
import { Switch } from './lib/switch'
import { adminNav } from './lib/nav'
import { FaceSwitch } from './templates'

type Staff = { id: string; email: string; name: string; role: 'SUPER_ADMIN' | 'SUPPORT' }

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const body = await api<{ csrfToken: string }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      setCsrf(body.csrfToken)
      navigate('/')
    } catch (cause) {
      setError(messageOf(cause))
    }
  }
  return (
    <form className="login stack card" onSubmit={onSubmit}>
      <h1>Staff login</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Email<Hint>The staff email.</Hint><input name="email" type="email" required /></label>
      <label>Password<Hint>At least 8 characters.</Hint><input name="password" type="password" required minLength={8} /></label>
      <button type="submit">Log in</button>
    </form>
  )
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [staff, setStaff] = useState<Staff | null>(null)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api<{ csrfToken: string }>('/api/admin/csrf')
      .then((body) => {
        setCsrf(body.csrfToken)
        return api<{ staff: Staff }>('/api/admin/auth/me')
      })
      .then((body) => setStaff(body.staff))
      .catch(() => setFailed(true))
  }, [])
  useEffect(() => setOpen(false), [location.pathname])
  if (failed) return <Navigate to="/login" replace />
  if (!staff) return <main className="panel">Loading staff session</main>
  const items = adminNav(staff.role)
  const allowed = items.some((item) => item.to === '/' ? location.pathname === '/' : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
  if (!allowed) return <Navigate to="/" replace />
  return (
    <div className="shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <strong>Staff</strong>
        {items.map((item) => <Link className={location.pathname === item.to ? 'active' : ''} key={item.to} to={item.to}>{item.label}</Link>)}
      </aside>
      <div>
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setOpen((value) => !value)}>Menu</button>
          <span>{staff.name} · {staff.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Support'}</span>
          <button className="secondary" type="button" onClick={() => void api('/api/admin/auth/logout', { method: 'POST' }).then(() => navigate('/login'))}>Log out</button>
        </header>
        <main className="panel">
          <Outlet context={{ staff }} />
        </main>
      </div>
    </div>
  )
}

function useStaff(): Staff {
  const [staff, setStaff] = useState<Staff | null>(null)
  useEffect(() => {
    api<{ staff: Staff }>('/api/admin/auth/me').then((body) => setStaff(body.staff)).catch(() => undefined)
  }, [])
  return staff ?? { id: '', email: '', name: '', role: 'SUPPORT' }
}

export function DashboardPage() {
  const [data, setData] = useState<{ organizations: number; users: number; subscriptions: Record<string, number> } | null>(null)
  useEffect(() => { api<NonNullable<typeof data>>('/api/admin/dashboard').then(setData).catch(() => undefined) }, [])
  return (
    <section className="stack">
      <h1>Dashboard</h1>
      <div className="cards">
        <article className="card"><span>Organizations</span><strong>{data?.organizations ?? '—'}</strong></article>
        <article className="card"><span>Users</span><strong>{data?.users ?? '—'}</strong></article>
        <article className="card"><span>Subscriptions</span><strong>{data ? Object.entries(data.subscriptions).map(([status, count]) => `${status} ${count}`).join(', ') : '—'}</strong></article>
      </div>
    </section>
  )
}

export function OrganizationsPage() {
  const staff = useStaff()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Array<{ id: string; name: string; slug: string; suspended: boolean; packageId?: string; status?: string }>>([])
  function load(next = page, query = q) {
    return api<{ organizations: typeof rows; page: number; total: number }>(`/api/admin/organizations?q=${encodeURIComponent(query)}&page=${next}`).then((body) => {
      if (!body.organizations.length && body.page > 1) { setPage(body.page - 1); return }
      setRows(body.organizations)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page, q).catch((cause) => setError(messageOf(cause))) }, [q, page])
  return (
    <section className="stack">
      <h1>Organizations</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Search
        <Hint>Match part of the organization name.</Hint>
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search name" />
      </label>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Name</th><th>Package</th><th>Status</th><th>Suspended</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link to={`/organizations/${row.id}`}>{row.name}</Link></td>
                <td>{row.packageId}</td>
                <td>{row.status}</td>
                <td>{row.suspended ? 'yes' : 'no'}</td>
                <td>
                  <div className="row">
                    <Link to={`/organizations/${row.id}`}>Edit</Link>
                    {staff.role === 'SUPER_ADMIN' ? <button className="secondary" type="button" onClick={() => {
                      if (!confirmDelete('this organization')) return
                      void api(`/api/admin/organizations/${row.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
                    }}>Delete</button> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Organizations" />
    </section>
  )
}

export function OrganizationDetail() {
  const { id = '' } = useParams()
  const staff = useStaff()
  const canEdit = staff.role === 'SUPER_ADMIN'
  const [org, setOrg] = useState<{
    name: string
    slug: string
    suspended: boolean
    timezone: string
    subscription: { status: string; packageId: string; packageName: string; seats: number } | null
    members: Array<{ id: string; email: string; name: string; role: string; disabled: boolean }>
    instagramAccounts: Array<{ id: string; username: string; status: string; lastError: string | null }>
    usage: Record<string, number>
    membersPage: number
    membersTotal: number
    accountsPage: number
    accountsTotal: number
  } | null>(null)
  const [membersPage, setMembersPage] = useState(1)
  const [accountsPage, setAccountsPage] = useState(1)
  const [error, setError] = useState('')
  function load(nextMembers = membersPage, nextAccounts = accountsPage) {
    return api<NonNullable<typeof org> & { id: string }>(`/api/admin/organizations/${id}?membersPage=${nextMembers}&accountsPage=${nextAccounts}`).then(setOrg)
  }
  useEffect(() => { load(membersPage, accountsPage).catch((cause) => setError(messageOf(cause))) }, [id, membersPage, accountsPage])
  if (!org) return <p>{error || 'Loading organization'}</p>
  return (
    <section className="stack">
      <h1>{org.name}</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>{org.slug} · {org.subscription?.packageName} · {org.subscription?.status} · {org.subscription?.seats} seats · {org.timezone}</p>
      <h2>Members</h2>
      <div className="table-scroll"><table><tbody>{org.members.map((member) => (
        <tr key={member.id}>
          <td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td>{member.disabled ? 'disabled' : 'active'}</td>
          <td>{canEdit && member.role !== 'OWNER' ? (
            <div className="row">
              <label>Edit role
                <Hint>Admin, editor, or support. The owner role stays put.</Hint>
                <select value={member.role} onChange={(event) => void api(`/api/admin/organizations/${id}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify({ role: event.target.value }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))}>
                  <option>ADMIN</option><option>EDITOR</option><option>SUPPORT</option>
                </select>
              </label>
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this member')) return
                void api(`/api/admin/organizations/${id}/members/${member.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          ) : null}</td>
        </tr>
      ))}</tbody></table></div>
      <Pager page={org.membersPage} total={org.membersTotal} onPage={setMembersPage} label="Members" />
      <h2>Instagram accounts</h2>
      <div className="table-scroll"><table><tbody>{org.instagramAccounts.map((account) => (
        <tr key={account.id}>
          <td>{account.id}</td><td>@{account.username}</td><td>{account.status}</td><td>{account.lastError ?? ''}</td>
          <td>{canEdit ? <button className="secondary" type="button" onClick={() => {
            if (!confirmDelete('this Instagram account')) return
            void api(`/api/admin/organizations/${id}/accounts/${account.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
          }}>Delete</button> : null}</td>
        </tr>
      ))}</tbody></table></div>
      <Pager page={org.accountsPage} total={org.accountsTotal} onPage={setAccountsPage} label="Instagram accounts" />
      <p>Usage — text {org.usage.text ?? 0}, photos {org.usage.image ?? 0}, videos {org.usage.video ?? 0}</p>
      {canEdit ? (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void api(`/api/admin/organizations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              suspended: form.get('suspended') === 'on',
              packageId: form.get('packageId'),
              seats: Number(form.get('seats')),
              timezone: form.get('timezone'),
            }),
          }).then(() => load()).catch((cause) => setError(messageOf(cause)))
        }}>
          <label>Suspended<Hint>A suspended organization cannot publish.</Hint><input name="suspended" type="checkbox" defaultChecked={org.suspended} /></label>
          <label>Package
            <Hint>Starter, Growth, or Pro.</Hint>
            <select name="packageId" defaultValue={org.subscription?.packageId}><option>starter</option><option>growth</option><option>pro</option></select>
          </label>
          <label>Seats<Hint>How many people can belong to this organization.</Hint><input name="seats" type="number" defaultValue={org.subscription?.seats ?? 1} /></label>
          <label>Timezone<Hint>An IANA timezone such as America/New_York.</Hint><input name="timezone" defaultValue={org.timezone} /></label>
          <button type="submit">Save organization</button>
        </form>
      ) : null}
    </section>
  )
}

export function UsersPage() {
  const staff = useStaff()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; disabled: boolean }>>([])
  function load(query = q, next = page) {
    return api<{ users: typeof users; page: number; total: number }>(`/api/admin/users?q=${encodeURIComponent(query)}&page=${next}`).then((body) => {
      if (!body.users.length && body.page > 1) { setPage(body.page - 1); return }
      setUsers(body.users)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(q, page).catch((cause) => setError(messageOf(cause))) }, [q, page])
  return (
    <section className="stack">
      <h1>Users</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Search
        <Hint>Match part of the email address.</Hint>
        <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} placeholder="Search email" />
      </label>
      <div className="table-scroll">
        <table>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{editing === user.id ? (
                  <label>Name
                    <Hint>The name shown in the workspace.</Hint>
                    <input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                ) : user.name}</td>
                <td>{user.email}</td>
                <td>{user.disabled ? 'disabled' : 'active'}</td>
                <td>{staff.role === 'SUPER_ADMIN' ? (
                  <div className="row">
                    {editing === user.id ? <button type="button" onClick={() => void api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }).then(() => { setEditing(''); return load() }).catch((cause) => setError(messageOf(cause)))}>Save</button> : <button className="secondary" type="button" onClick={() => { setEditing(user.id); setName(user.name) }}>Edit</button>}
                    <button type="button" onClick={() => void api(`/api/admin/users/${user.id}/disable`, { method: 'POST', body: JSON.stringify({ disabled: !user.disabled }) }).then(() => load())}>{user.disabled ? 'Enable' : 'Disable'}</button>
                    <button className="secondary" type="button" onClick={() => {
                      if (!confirmDelete('this user')) return
                      void api(`/api/admin/users/${user.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
                    }}>Delete</button>
                  </div>
                ) : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Users" />
    </section>
  )
}

export function PackagesPage() {
  const staff = useStaff()
  const [packages, setPackages] = useState<Array<Record<string, string | number | boolean>>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  function load(next = page) {
    return api<{ packages: typeof packages; page: number; total: number }>(`/api/admin/packages?page=${next}`).then((body) => {
      if (!body.packages.length && body.page > 1) { setPage(body.page - 1); return }
      setPackages(body.packages)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Packages</h1>
      {error ? <p className="error">{error}</p> : null}
      {packages.map((pkg) => (
        <form className="card stack" key={String(pkg.id)} onSubmit={(event) => {
          event.preventDefault()
          if (staff.role !== 'SUPER_ADMIN') return
          const form = new FormData(event.currentTarget)
          void api(`/api/admin/packages/${pkg.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: form.get('name'),
              priceMinor: Number(form.get('priceMinor')),
              monthlyAiGenerations: Number(form.get('monthlyAiGenerations')),
              monthlyImageGenerations: Number(form.get('monthlyImageGenerations')),
              monthlyVideoGenerations: Number(form.get('monthlyVideoGenerations')),
              scheduling: form.get('scheduling') === 'on',
              videoGeneration: form.get('videoGeneration') === 'on',
              customAi: form.get('customAi') === 'on',
            }),
          }).then(() => load())
        }}>
          <strong>{String(pkg.name)}</strong>
          <label>Name<Hint>The package name customers see.</Hint><input name="name" defaultValue={String(pkg.name)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Price in minor units<Hint>Price in the smallest currency unit, such as cents.</Hint><input name="priceMinor" type="number" defaultValue={Number(pkg.priceMinor)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Text<Hint>How many text generations are included each period.</Hint><input name="monthlyAiGenerations" type="number" defaultValue={Number(pkg.monthlyAiGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Photos<Hint>How many photo generations are included each period.</Hint><input name="monthlyImageGenerations" type="number" defaultValue={Number(pkg.monthlyImageGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Videos<Hint>How many video generations are included each period.</Hint><input name="monthlyVideoGenerations" type="number" defaultValue={Number(pkg.monthlyVideoGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Scheduling<Hint>Allow the planner on this package.</Hint><input name="scheduling" type="checkbox" defaultChecked={Boolean(pkg.scheduling)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Video<Hint>Allow video generation on this package.</Hint><input name="videoGeneration" type="checkbox" defaultChecked={Boolean(pkg.videoGeneration)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Custom AI<Hint>Allow a customer model key and instructions.</Hint><input name="customAi" type="checkbox" defaultChecked={Boolean(pkg.customAi)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          {staff.role === 'SUPER_ADMIN' ? (
            <div className="row">
              <button type="submit">Edit</button>
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this package')) return
                void api(`/api/admin/packages/${pkg.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          ) : null}
        </form>
      ))}
      <Pager page={page} total={total} onPage={setPage} label="Packages" />
    </section>
  )
}

export function SubscriptionsPage() {
  const staff = useStaff()
  const [rows, setRows] = useState<Array<{ id: string; organizationId: string; packageId: string; status: string; seats: number }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  function load(next = page) {
    return api<{ subscriptions: typeof rows; page: number; total: number }>(`/api/admin/subscriptions?page=${next}`).then((body) => {
      setRows(body.subscriptions)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch(() => undefined) }, [page])
  return (
    <section className="stack">
      <h1>Subscriptions</h1>
      <div className="table-scroll">
        <table>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.organizationId}</td><td>{row.packageId}</td><td>{row.seats} seats</td>
                <td>{staff.role === 'SUPER_ADMIN' ? (
                  <label>Edit status
                    <Hint>Trialing, active, past due, or canceled. Canceling stops writes. The subscription row stays so the organization keeps a package.</Hint>
                    <select defaultValue={row.status} onChange={(event) => void api(`/api/admin/subscriptions/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }).then(() => load())}>
                      <option>trialing</option><option>active</option><option>past_due</option><option>canceled</option>
                    </select>
                  </label>
                ) : row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Subscriptions" />
    </section>
  )
}

export function UsagePage() {
  const [rows, setRows] = useState<Array<{ organizationId: string; kind: string; count: number }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    api<{ usage: typeof rows; page: number; total: number }>(`/api/admin/usage?page=${page}`).then((body) => {
      setRows(body.usage)
      setPage(body.page)
      setTotal(body.total)
    }).catch(() => undefined)
  }, [page])
  return (
    <section className="stack">
      <h1>Usage</h1>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Organization</th><th>Kind</th><th>Count</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.organizationId}-${row.kind}`}><td>{row.organizationId}</td><td>{row.kind}</td><td>{row.count}</td></tr>)}</tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Usage" />
    </section>
  )
}

type Settings = {
  general: { productName: string; logo: string; supportEmail: string; publicSiteUrl: string; registrationOpen: boolean; maintenanceMessage: string }
  legal: { privacy: string; terms: string; dataDeletion: string }
  features: { scheduling: boolean; videoGeneration: boolean; inboxAutomation: boolean; customAi: boolean; signups: boolean }
  ai: { allowedModels: { starter: string[]; growth: string[]; pro: string[] } }
  instagram: { oauthCallbackUrl: string }
  email: { inviteTemplate: string; resetTemplate: string }
  seo: { titleTemplate: string; siteDescription: string; canonicalHost: string; defaultShareImage: string }
  robots: string
}


type OauthFlags = Record<'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'google', { clientIdSet: boolean; clientSecretSet: boolean }>

function OauthApps() {
  const [flags, setFlags] = useState<OauthFlags | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    api<OauthFlags>('/api/admin/oauth-apps').then(setFlags).catch((cause) => setError(messageOf(cause)))
  }, [])
  const apps = ['instagram', 'facebook', 'tiktok', 'youtube', 'google'] as const
  return (
    <form className="card stack" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const body: Record<string, { clientId?: string; clientSecret?: string }> = {}
      for (const app of apps) {
        const clientId = String(form.get(`${app}ClientId`) ?? '').trim()
        const clientSecret = String(form.get(`${app}ClientSecret`) ?? '').trim()
        if (!clientId && !clientSecret) continue
        body[app] = {}
        if (clientId) body[app].clientId = clientId
        if (clientSecret) body[app].clientSecret = clientSecret
      }
      void api<OauthFlags>('/api/admin/oauth-apps', { method: 'PUT', body: JSON.stringify(body) })
        .then((next) => { setFlags(next); setNotice('Saved') })
        .catch((cause) => setError(messageOf(cause)))
      event.currentTarget.reset()
    }}>
      <h2>Network and Google login</h2>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p>{notice}</p> : null}
      <p>Client ids and secrets are encrypted and are never shown again.</p>
      {apps.map((app) => (
        <div className="stack" key={app}>
          <strong>{app} · id {flags?.[app]?.clientIdSet ? 'set' : 'not set'} · secret {flags?.[app]?.clientSecretSet ? 'set' : 'not set'}</strong>
          <label>{app} client id<Hint>Leave blank to keep the stored client id.</Hint><input name={`${app}ClientId`} autoComplete="off" placeholder={flags?.[app]?.clientIdSet ? 'A client id is stored' : 'Not set'} /></label>
          <label>{app} client secret<Hint>Leave blank to keep the stored secret. It is not shown again.</Hint><input name={`${app}ClientSecret`} type="password" autoComplete="off" placeholder={flags?.[app]?.clientSecretSet ? 'A secret is stored' : 'Not set'} /></label>
        </div>
      ))}
      <button type="submit">Save network apps</button>
    </form>
  )
}

function ProviderSecrets({ superAdmin }: { superAdmin: boolean }) {
  const [flags, setFlags] = useState<ProviderFlags | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<ProviderToggleField | null>(null)
  useEffect(() => {
    api<ProviderFlags>('/api/admin/provider-status').then(setFlags).catch((cause) => setError(messageOf(cause)))
  }, [])
  async function save(body: Record<string, string | null>) {
    const next = await api<ProviderFlags>('/api/admin/provider-secrets', { method: 'PUT', body: JSON.stringify(body) })
    setFlags(next)
    setError('')
    setNotice('Saved')
  }
  async function toggle(field: ProviderToggleField, name: string, enabled: boolean) {
    const previous = flags
    setPending(field)
    setError('')
    setFlags((current) => (current ? { ...current, [field]: enabled } : current))
    setNotice(toggleNotice(name, enabled))
    try {
      const next = await api<ProviderFlags>('/api/admin/provider-secrets', { method: 'PUT', body: JSON.stringify({ [field]: enabled }) })
      setFlags(next)
    } catch (cause) {
      setFlags(previous)
      setNotice('')
      setError(messageOf(cause))
    } finally {
      setPending(null)
    }
  }
  const fields = {
    openaiEnabled: (
      <label>OpenAI key<Hint>Leave blank to keep the stored key.</Hint><input name="openaiKey" type="password" autoComplete="off" placeholder={flags?.openaiKeySet ? 'A key is stored' : 'Not set'} /></label>
    ),
    runwayEnabled: (
      <label>Runway key<Hint>Leave blank to keep the stored key.</Hint><input name="runwayKey" type="password" autoComplete="off" placeholder={flags?.runwayKeySet ? 'A key is stored' : 'Not set'} /></label>
    ),
    videoProviderUrlEnabled: (
      <label>Video provider URL<Hint>The https address of the video provider. Leave blank to keep the stored URL.</Hint><input name="videoProviderUrl" type="url" autoComplete="off" placeholder={flags?.videoProviderUrlSet ? 'A URL is stored' : 'https://'} /></label>
    ),
  }
  return (
    <form className="card stack" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      const body: Record<string, string> = {}
      for (const key of ['openaiKey', 'runwayKey', 'videoProviderUrl']) {
        const value = String(form.get(key) ?? '').trim()
        if (value) body[key] = value
      }
      void save(body).catch((cause) => setError(messageOf(cause)))
      event.currentTarget.reset()
    }}>
      <h2>Provider secrets</h2>
      {error ? <p className="error">{error}</p> : null}
      <p role="status" aria-live="polite">{notice}</p>
      <p className="provider-status">{providerStatusLine(flags)}</p>
      {PROVIDER_TOGGLES.map((item) => (
        <div className="provider-field" key={item.field}>
          {superAdmin ? fields[item.field] : <strong>{item.name}</strong>}
          <div className="provider-switch">
            <Switch
              id={`switch-${item.field}`}
              label={item.label}
              checked={isOn(flags, item.field)}
              disabled={!superAdmin || !flags || pending !== null}
              describedBy={`switch-help-${item.field}`}
              onChange={(next) => void toggle(item.field, item.name, next)}
            />
            <small className="hint" id={`switch-help-${item.field}`}>{item.help}</small>
          </div>
        </div>
      ))}
      {superAdmin ? (
        <div className="row">
          <button type="submit">Save secrets</button>
          <button className="secondary" type="button" onClick={() => void save({ openaiKey: null }).catch((cause) => setError(messageOf(cause)))}>Clear OpenAI key</button>
          <button className="secondary" type="button" onClick={() => void save({ runwayKey: null }).catch((cause) => setError(messageOf(cause)))}>Clear Runway key</button>
          <button className="secondary" type="button" onClick={() => void save({ videoProviderUrl: null }).catch((cause) => setError(messageOf(cause)))}>Clear video URL</button>
        </div>
      ) : <p>Support can see whether each secret is set and switched on. Only a Super Admin can save, clear, or switch them.</p>}
    </form>
  )
}

export function SettingsPage() {
  const { staff } = useOutletContext<{ staff: Staff }>()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [flags, setFlags] = useState({ platformKeySet: false, metaAppIdSet: false })
  const [error, setError] = useState('')
  useEffect(() => {
    if (staff.role !== 'SUPER_ADMIN') return
    api<{ settings: Settings; platformKeySet: boolean; metaAppIdSet: boolean }>('/api/admin/settings').then((body) => {
      setSettings(body.settings)
      setFlags({ platformKeySet: body.platformKeySet, metaAppIdSet: body.metaAppIdSet })
    }).catch((cause) => setError(messageOf(cause)))
  }, [staff.role])
  async function save(patch: Partial<Settings>) {
    const body = await api<{ settings: Settings; platformKeySet: boolean; metaAppIdSet: boolean }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(patch) })
    setSettings(body.settings)
    setFlags({ platformKeySet: body.platformKeySet, metaAppIdSet: body.metaAppIdSet })
  }
  if (staff.role !== 'SUPER_ADMIN') {
    return (
      <section className="stack">
        <h1>Site settings</h1>
        <ProviderSecrets superAdmin={false} />
        <FaceSwitch superAdmin={false} />
      </section>
    )
  }
  if (!settings) return <p>{error || 'Loading settings'}</p>
  return (
    <section className="stack">
      <h1>Site settings</h1>
      {error ? <p className="error">{error}</p> : null}
      <ProviderSecrets superAdmin />
      <FaceSwitch superAdmin />
      <OauthApps />
      <p>Platform text key: {flags.platformKeySet ? 'set' : 'not set'}. Meta app id: {flags.metaAppIdSet ? 'set' : 'not set'}.</p>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ general: { productName: String(form.get('productName')), logo: String(form.get('logo')), supportEmail: String(form.get('supportEmail')), publicSiteUrl: String(form.get('publicSiteUrl')), registrationOpen: form.get('registrationOpen') === 'on', maintenanceMessage: String(form.get('maintenanceMessage')) } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>General</h2>
        <label>Product<Hint>The product name on the public site.</Hint><input name="productName" defaultValue={settings.general.productName} /></label>
        <label>Logo URL<Hint>A public address for the logo image.</Hint><input name="logo" defaultValue={settings.general.logo} /></label>
        <label>Support email<Hint>The address customers should write to.</Hint><input name="supportEmail" defaultValue={settings.general.supportEmail} /></label>
        <label>Public site URL<Hint>The site origin, including https.</Hint><input name="publicSiteUrl" defaultValue={settings.general.publicSiteUrl} /></label>
        <label>Registration open<Hint>Allow new accounts to sign up.</Hint><input name="registrationOpen" type="checkbox" defaultChecked={settings.general.registrationOpen} /></label>
        <label>Maintenance message<Hint>Shown to signed-in customers. Leave blank to hide it.</Hint><textarea name="maintenanceMessage" defaultValue={settings.general.maintenanceMessage} /></label>
        <button type="submit">Save general</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ legal: { privacy: String(form.get('privacy')), terms: String(form.get('terms')), dataDeletion: String(form.get('dataDeletion')) } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Legal</h2>
        <label>Privacy<Hint>The privacy policy shown on the public page.</Hint><textarea name="privacy" defaultValue={settings.legal.privacy} rows={4} /></label>
        <label>Terms<Hint>The terms shown on the public page.</Hint><textarea name="terms" defaultValue={settings.legal.terms} rows={4} /></label>
        <label>Data deletion<Hint>How a customer asks for their data to be deleted.</Hint><textarea name="dataDeletion" defaultValue={settings.legal.dataDeletion} rows={4} /></label>
        <button type="submit">Save legal</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ features: { scheduling: form.get('scheduling') === 'on', videoGeneration: form.get('videoGeneration') === 'on', inboxAutomation: form.get('inboxAutomation') === 'on', customAi: form.get('customAi') === 'on', signups: form.get('signups') === 'on' } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Features</h2>
        {(['scheduling', 'videoGeneration', 'inboxAutomation', 'customAi', 'signups'] as const).map((key) => (
          <label key={key}>{key}<Hint>Turn this feature on or off for the whole site.</Hint><input name={key} type="checkbox" defaultChecked={settings.features[key]} /></label>
        ))}
        <button type="submit">Save features</button>
      </form>
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const list = (name: string) => String(form.get(name)).split(',').map((item) => item.trim()).filter(Boolean)
        void save({ ai: { allowedModels: { starter: list('starter'), growth: list('growth'), pro: list('pro') } } }).catch((cause) => setError(messageOf(cause)))
      }}>
        <h2>Models</h2>
        <label>Starter<Hint>Comma-separated model ids allowed on Starter.</Hint><input name="starter" defaultValue={settings.ai.allowedModels.starter.join(', ')} /></label>
        <label>Growth<Hint>Comma-separated model ids allowed on Growth.</Hint><input name="growth" defaultValue={settings.ai.allowedModels.growth.join(', ')} /></label>
        <label>Pro<Hint>Comma-separated model ids allowed on Pro.</Hint><input name="pro" defaultValue={settings.ai.allowedModels.pro.join(', ')} /></label>
        <button type="submit">Save models</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ instagram: { oauthCallbackUrl: String(form.get('oauthCallbackUrl')) }, email: { inviteTemplate: String(form.get('inviteTemplate')), resetTemplate: String(form.get('resetTemplate')) }, seo: { titleTemplate: String(form.get('titleTemplate')), siteDescription: String(form.get('siteDescription')), canonicalHost: String(form.get('canonicalHost')), defaultShareImage: String(form.get('defaultShareImage')) }, robots: String(form.get('robots')) }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Instagram, email, SEO, robots</h2>
        <label>OAuth callback<Hint>The address Meta redirects to after login.</Hint><input name="oauthCallbackUrl" defaultValue={settings.instagram.oauthCallbackUrl} /></label>
        <label>Invite template<Hint>The email body for a team invitation.</Hint><textarea name="inviteTemplate" defaultValue={settings.email.inviteTemplate} /></label>
        <label>Reset template<Hint>The email body for a password reset.</Hint><textarea name="resetTemplate" defaultValue={settings.email.resetTemplate} /></label>
        <label>Title template<Hint>How public page titles are formatted.</Hint><input name="titleTemplate" defaultValue={settings.seo.titleTemplate} /></label>
        <label>Site description<Hint>The default description for search results.</Hint><input name="siteDescription" defaultValue={settings.seo.siteDescription} /></label>
        <label>Canonical host<Hint>The public host, including https.</Hint><input name="canonicalHost" defaultValue={settings.seo.canonicalHost} /></label>
        <label>Share image<Hint>The default image address for link previews.</Hint><input name="defaultShareImage" defaultValue={settings.seo.defaultShareImage} /></label>
        <label>robots.txt<Hint>The crawler rules for the public site.</Hint><textarea name="robots" defaultValue={settings.robots} rows={5} /></label>
        <button type="submit">Save the rest</button>
      </form>
    </section>
  )
}

type SeoPage = { id: string; path: string; title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; indexed: boolean; inSitemap: boolean }

export function SeoPage() {
  const [pages, setPages] = useState<SeoPage[]>([])
  const [pagesPage, setPagesPage] = useState(1)
  const [pagesTotal, setPagesTotal] = useState(0)
  const [selected, setSelected] = useState('')
  const [robots, setRobots] = useState('')
  const [host, setHost] = useState('')
  const [redirects, setRedirects] = useState<Array<{ id: string; fromPath: string; toPath: string; statusCode: number }>>([])
  const [redirectsPage, setRedirectsPage] = useState(1)
  const [redirectsTotal, setRedirectsTotal] = useState(0)
  const [editingRedirect, setEditingRedirect] = useState('')
  const [redirectDraft, setRedirectDraft] = useState({ fromPath: '', toPath: '' })
  const [sets, setSets] = useState<Array<{ id: string; name: string; category: string; keywords: string[]; hashtags: string[] }>>([])
  const [setsPage, setSetsPage] = useState(1)
  const [setsTotal, setSetsTotal] = useState(0)
  const [editingSet, setEditingSet] = useState('')
  const [setDraft, setSetDraft] = useState({ name: '', category: '', keywords: '', hashtags: '' })
  const [error, setError] = useState('')
  const page = pages.find((item) => item.id === selected) ?? pages[0]
  function load(nextPages = pagesPage, nextRedirects = redirectsPage, nextSets = setsPage) {
    return Promise.all([
      api<{ pages: SeoPage[]; page: number; total: number }>(`/api/admin/seo/pages?page=${nextPages}`),
      api<{ robots: string }>('/api/admin/seo/robots'),
      api<{ redirects: typeof redirects; page: number; total: number }>(`/api/admin/seo/redirects?page=${nextRedirects}`),
      api<{ sets: typeof sets; page: number; total: number }>(`/api/admin/seo/sets?page=${nextSets}`),
      api<{ settings: { seo: { canonicalHost: string } } }>('/api/admin/settings'),
    ]).then(([pageBody, robotBody, redirectBody, setBody, settings]) => {
      setPages(pageBody.pages)
      setPagesPage(pageBody.page)
      setPagesTotal(pageBody.total)
      setRobots(robotBody.robots)
      setRedirects(redirectBody.redirects)
      setRedirectsPage(redirectBody.page)
      setRedirectsTotal(redirectBody.total)
      setSets(setBody.sets)
      setSetsPage(setBody.page)
      setSetsTotal(setBody.total)
      setHost(settings.settings.seo.canonicalHost)
    })
  }
  useEffect(() => { load(pagesPage, redirectsPage, setsPage).catch((cause) => setError(messageOf(cause))) }, [pagesPage, redirectsPage, setsPage])
  return (
    <section className="stack">
      <h1>SEO</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-scroll">
        <table>
          <tbody>{pages.map((item) => (
            <tr key={item.id}>
              <td>{item.path}</td>
              <td>{item.title}</td>
              <td>{item.indexed ? 'index' : 'noindex'}</td>
              <td>
                <div className="row">
                  <button className="secondary" type="button" onClick={() => setSelected(item.id)}>Edit</button>
                  <button className="secondary" type="button" onClick={() => {
                    if (!confirmDelete('this public page')) return
                    void api(`/api/admin/seo/pages/${item.id}`, { method: 'DELETE' }).then(() => { if (selected === item.id) setSelected(''); return load() }).catch((cause) => setError(messageOf(cause)))
                  }}>Delete</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <Pager page={pagesPage} total={pagesTotal} onPage={setPagesPage} label="Public pages" />
      {page ? (
        <form className="card stack" key={page.id} onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void api(`/api/admin/seo/pages/${page.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              title: form.get('title'),
              description: form.get('description'),
              ogTitle: form.get('ogTitle'),
              ogDescription: form.get('ogDescription'),
              indexed: form.get('indexed') === 'on',
              inSitemap: form.get('inSitemap') === 'on',
            }),
          }).then(() => load()).catch((cause) => setError(messageOf(cause)))
        }}>
          <h2>{page.path}</h2>
          <div className="search-preview">
            <div className="search-title">{page.title}</div>
            <div className="search-url">{host}{page.path}</div>
            <div>{page.description}</div>
          </div>
          <label>Title<Hint>The title shown in search results.</Hint><input name="title" defaultValue={page.title} /></label>
          <label>Description<Hint>The snippet shown under the title.</Hint><textarea name="description" defaultValue={page.description} /></label>
          <label>Open Graph title<Hint>The title used when the page is shared.</Hint><input name="ogTitle" defaultValue={page.ogTitle} /></label>
          <label>Open Graph description<Hint>The description used when the page is shared.</Hint><input name="ogDescription" defaultValue={page.ogDescription} /></label>
          <label>Indexed<Hint>Allow search engines to index this page.</Hint><input name="indexed" type="checkbox" defaultChecked={page.indexed} /></label>
          <label>In sitemap<Hint>Include this page in the sitemap.</Hint><input name="inSitemap" type="checkbox" defaultChecked={page.inSitemap} /></label>
          <button type="submit">Save page</button>
        </form>
      ) : null}
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); void api('/api/admin/seo/robots', { method: 'PUT', body: JSON.stringify({ robots }) }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>robots.txt</h2>
        <label>robots.txt
          <Hint>The crawler rules for the public site.</Hint>
          <textarea value={robots} onChange={(event) => setRobots(event.target.value)} rows={6} />
        </label>
        <button type="submit">Save robots</button>
      </form>
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api('/api/admin/seo/redirects', { method: 'POST', body: JSON.stringify({ fromPath: form.get('fromPath'), toPath: form.get('toPath'), statusCode: 301 }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))
      }}>
        <h2>Redirects</h2>
        <ul className="stack">{redirects.map((redirect) => (
          <li key={redirect.id}>
            {editingRedirect === redirect.id ? (
              <form className="stack" onSubmit={(event) => {
                event.preventDefault()
                void api(`/api/admin/seo/redirects/${redirect.id}`, { method: 'PATCH', body: JSON.stringify(redirectDraft) })
                  .then(() => { setEditingRedirect(''); return load() })
                  .catch((cause) => setError(messageOf(cause)))
              }}>
                <label>From<Hint>The path that should redirect, starting with /.</Hint><input value={redirectDraft.fromPath} onChange={(event) => setRedirectDraft({ ...redirectDraft, fromPath: event.target.value })} required /></label>
                <label>To<Hint>The path to open instead.</Hint><input value={redirectDraft.toPath} onChange={(event) => setRedirectDraft({ ...redirectDraft, toPath: event.target.value })} required /></label>
                <button type="submit">Save</button>
              </form>
            ) : <span>{redirect.fromPath} → {redirect.toPath}</span>}
            <div className="row">
              <button className="secondary" type="button" onClick={() => { setEditingRedirect(redirect.id); setRedirectDraft({ fromPath: redirect.fromPath, toPath: redirect.toPath }) }}>Edit</button>
              <button type="button" onClick={() => {
                if (!confirmDelete('this redirect')) return
                void api(`/api/admin/seo/redirects/${redirect.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          </li>
        ))}</ul>
        <Pager page={redirectsPage} total={redirectsTotal} onPage={setRedirectsPage} label="Redirects" />
        <label>From<Hint>The path that should redirect, starting with /.</Hint><input name="fromPath" required /></label>
        <label>To<Hint>The path to open instead.</Hint><input name="toPath" required /></label>
        <button type="submit">Add redirect</button>
      </form>
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const hashtags = String(form.get('hashtags')).split(',').map((item) => item.trim()).filter(Boolean)
        if (hashtags.length > 10) { setError('A keyword set can keep at most 10 hashtags'); return }
        void api('/api/admin/seo/sets', { method: 'POST', body: JSON.stringify({ name: form.get('name'), category: form.get('category'), keywords: String(form.get('keywords')).split(',').map((item) => item.trim()).filter(Boolean), hashtags }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))
      }}>
        <h2>Keyword and hashtag library</h2>
        <ul className="stack">{sets.map((set) => (
          <li key={set.id}>
            {editingSet === set.id ? (
              <form className="stack" onSubmit={(event) => {
                event.preventDefault()
                const hashtags = setDraft.hashtags.split(',').map((item) => item.trim()).filter(Boolean)
                if (hashtags.length > 10) { setError('A keyword set can keep at most 10 hashtags'); return }
                void api(`/api/admin/seo/sets/${set.id}`, { method: 'PATCH', body: JSON.stringify({ name: setDraft.name, category: setDraft.category, keywords: setDraft.keywords.split(',').map((item) => item.trim()).filter(Boolean), hashtags }) })
                  .then(() => { setEditingSet(''); return load() })
                  .catch((cause) => setError(messageOf(cause)))
              }}>
                <label>Name<Hint>The library name shown when applying a set.</Hint><input value={setDraft.name} onChange={(event) => setSetDraft({ ...setDraft, name: event.target.value })} required /></label>
                <label>Category<Hint>The content category this set belongs to.</Hint><input value={setDraft.category} onChange={(event) => setSetDraft({ ...setDraft, category: event.target.value })} required /></label>
                <label>Keywords<Hint>Comma-separated search phrases.</Hint><input value={setDraft.keywords} onChange={(event) => setSetDraft({ ...setDraft, keywords: event.target.value })} /></label>
                <label>Hashtags<Hint>Up to 10 tags, separated by commas.</Hint><input value={setDraft.hashtags} onChange={(event) => setSetDraft({ ...setDraft, hashtags: event.target.value })} /></label>
                <button type="submit">Save</button>
              </form>
            ) : <span>{set.name} · {set.category} · {(set.hashtags ?? []).join(' ')}</span>}
            <div className="row">
              <button className="secondary" type="button" onClick={() => { setEditingSet(set.id); setSetDraft({ name: set.name, category: set.category, keywords: (set.keywords ?? []).join(', '), hashtags: (set.hashtags ?? []).join(', ') }) }}>Edit</button>
              <button className="secondary" type="button" onClick={() => {
                if (!confirmDelete('this keyword set')) return
                void api(`/api/admin/seo/sets/${set.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
              }}>Delete</button>
            </div>
          </li>
        ))}</ul>
        <Pager page={setsPage} total={setsTotal} onPage={setSetsPage} label="Keyword sets" />
        <label>Name<Hint>The library name shown when applying a set.</Hint><input name="name" required /></label>
        <label>Category<Hint>The content category this set belongs to.</Hint><input name="category" required /></label>
        <label>Keywords<Hint>Comma-separated search phrases.</Hint><input name="keywords" placeholder="comma separated" /></label>
        <label>Hashtags<Hint>Up to 10 tags, separated by commas.</Hint><input name="hashtags" placeholder="up to 10, comma separated" /></label>
        <button type="submit">Add set</button>
      </form>
    </section>
  )
}

export function AuditPage() {
  const [logs, setLogs] = useState<Array<{ id: string; action: string; actorType: string; createdAt: string; organizationId: string | null }>>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    api<{ logs: typeof logs; page: number; total: number }>(`/api/admin/audit?page=${page}`).then((body) => {
      setLogs(body.logs)
      setPage(body.page)
      setTotal(body.total)
    }).catch(() => undefined)
  }, [page])
  return (
    <section className="stack">
      <h1>Audit</h1>
      <div className="table-scroll">
        <table>
          <tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorType}</td><td>{log.action}</td><td>{log.organizationId ?? ''}</td></tr>)}</tbody>
        </table>
      </div>
      <Pager page={page} total={total} onPage={setPage} label="Audit log" />
    </section>
  )
}

export function StaffPage() {
  const current = useStaff()
  const [staff, setStaff] = useState<Staff[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState('')
  const [draft, setDraft] = useState({ name: '', role: 'SUPPORT' as Staff['role'] })
  const [error, setError] = useState('')
  function load(next = page) {
    return api<{ staff: Staff[]; page: number; total: number }>(`/api/admin/staff?page=${next}`).then((body) => {
      if (!body.staff.length && body.page > 1) { setPage(body.page - 1); return }
      setStaff(body.staff)
      setPage(body.page)
      setTotal(body.total)
    })
  }
  useEffect(() => { load(page).catch((cause) => setError(messageOf(cause))) }, [page])
  return (
    <section className="stack">
      <h1>Staff</h1>
      {error ? <p className="error">{error}</p> : null}
      <ul className="stack">{staff.map((person) => (
        <li key={person.id}>
          {editing === person.id ? (
            <form className="stack" onSubmit={(event) => {
              event.preventDefault()
              void api(`/api/admin/staff/${person.id}`, { method: 'PATCH', body: JSON.stringify(draft) })
                .then(() => { setEditing(''); return load() })
                .catch((cause) => setError(messageOf(cause)))
            }}>
              <label>Name<Hint>The name shown in the staff header.</Hint><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
              <label>Role
                <Hint>Support can operate customer accounts. Super Admin can change site settings.</Hint>
                <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as Staff['role'] })}><option>SUPPORT</option><option>SUPER_ADMIN</option></select>
              </label>
              <button type="submit">Save</button>
            </form>
          ) : <span>{person.name} · {person.email} · {person.role}</span>}
          <div className="row">
            <button className="secondary" type="button" onClick={() => { setEditing(person.id); setDraft({ name: person.name, role: person.role }) }}>Edit</button>
            {person.id !== current.id ? <button className="secondary" type="button" onClick={() => {
              if (!confirmDelete('this staff account')) return
              void api(`/api/admin/staff/${person.id}`, { method: 'DELETE' }).then(() => load()).catch((cause) => setError(messageOf(cause)))
            }}>Delete</button> : null}
          </div>
        </li>
      ))}</ul>
      <Pager page={page} total={total} onPage={setPage} label="Staff" />
      <form className="stack card" onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        void api('/api/admin/staff', { method: 'POST', body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password'), role: data.get('role') }) }).then(() => { form.reset(); return load() }).catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Name<Hint>The name shown in the staff header.</Hint><input name="name" required /></label>
        <label>Email<Hint>The address this person uses to log in.</Hint><input name="email" type="email" required /></label>
        <label>Password<Hint>At least 8 characters.</Hint><input name="password" type="password" minLength={8} required /></label>
        <label>Role
          <Hint>Support can operate customer accounts. Super Admin can change site settings.</Hint>
          <select name="role"><option>SUPPORT</option><option>SUPER_ADMIN</option></select>
        </label>
        <button type="submit">Add staff</button>
      </form>
    </section>
  )
}
