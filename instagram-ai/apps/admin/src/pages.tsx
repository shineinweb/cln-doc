import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, setCsrf } from './lib/api'
import { adminNav } from './lib/nav'

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
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" required minLength={8} /></label>
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
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Array<{ id: string; name: string; slug: string; suspended: boolean; packageId?: string; status?: string }>>([])
  useEffect(() => {
    api<{ organizations: typeof rows }>(`/api/admin/organizations?q=${encodeURIComponent(q)}`).then((body) => setRows(body.organizations)).catch(() => undefined)
  }, [q])
  return (
    <section className="stack">
      <h1>Organizations</h1>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name" />
      <div className="table-scroll">
        <table>
          <thead><tr><th>Name</th><th>Package</th><th>Status</th><th>Suspended</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}><td><Link to={`/organizations/${row.id}`}>{row.name}</Link></td><td>{row.packageId}</td><td>{row.status}</td><td>{row.suspended ? 'yes' : 'no'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
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
  } | null>(null)
  const [error, setError] = useState('')
  function load() {
    return api<NonNullable<typeof org> & { id: string }>(`/api/admin/organizations/${id}`).then(setOrg)
  }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [id])
  if (!org) return <p>{error || 'Loading organization'}</p>
  return (
    <section className="stack">
      <h1>{org.name}</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>{org.slug} · {org.subscription?.packageName} · {org.subscription?.status} · {org.subscription?.seats} seats · {org.timezone}</p>
      <h2>Members</h2>
      <div className="table-scroll"><table><tbody>{org.members.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td>{member.role}</td><td>{member.disabled ? 'disabled' : 'active'}</td></tr>)}</tbody></table></div>
      <h2>Instagram accounts</h2>
      <div className="table-scroll"><table><tbody>{org.instagramAccounts.map((account) => <tr key={account.id}><td>{account.id}</td><td>@{account.username}</td><td>{account.status}</td><td>{account.lastError ?? ''}</td></tr>)}</tbody></table></div>
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
          <label>Suspended<input name="suspended" type="checkbox" defaultChecked={org.suspended} /></label>
          <label>Package
            <select name="packageId" defaultValue={org.subscription?.packageId}><option>starter</option><option>growth</option><option>pro</option></select>
          </label>
          <label>Seats<input name="seats" type="number" defaultValue={org.subscription?.seats ?? 1} /></label>
          <label>Timezone<input name="timezone" defaultValue={org.timezone} /></label>
          <button type="submit">Save organization</button>
        </form>
      ) : null}
    </section>
  )
}

export function UsersPage() {
  const staff = useStaff()
  const [q, setQ] = useState('')
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; disabled: boolean }>>([])
  function load(query: string) { return api<{ users: typeof users }>(`/api/admin/users?q=${encodeURIComponent(query)}`).then((body) => setUsers(body.users)) }
  useEffect(() => { load(q).catch(() => undefined) }, [q])
  return (
    <section className="stack">
      <h1>Users</h1>
      <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search email" />
      <div className="table-scroll">
        <table>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td><td>{user.email}</td><td>{user.disabled ? 'disabled' : 'active'}</td>
                <td>{staff.role === 'SUPER_ADMIN' ? <button type="button" onClick={() => void api(`/api/admin/users/${user.id}/disable`, { method: 'POST', body: JSON.stringify({ disabled: !user.disabled }) }).then(() => load(q))}>{user.disabled ? 'Enable' : 'Disable'}</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function PackagesPage() {
  const staff = useStaff()
  const [packages, setPackages] = useState<Array<Record<string, string | number | boolean>>>([])
  function load() { return api<{ packages: typeof packages }>('/api/admin/packages').then((body) => setPackages(body.packages)) }
  useEffect(() => { load().catch(() => undefined) }, [])
  return (
    <section className="stack">
      <h1>Packages</h1>
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
          <label>Name<input name="name" defaultValue={String(pkg.name)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Price in minor units<input name="priceMinor" type="number" defaultValue={Number(pkg.priceMinor)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Text<input name="monthlyAiGenerations" type="number" defaultValue={Number(pkg.monthlyAiGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Photos<input name="monthlyImageGenerations" type="number" defaultValue={Number(pkg.monthlyImageGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Videos<input name="monthlyVideoGenerations" type="number" defaultValue={Number(pkg.monthlyVideoGenerations)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Scheduling<input name="scheduling" type="checkbox" defaultChecked={Boolean(pkg.scheduling)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Video<input name="videoGeneration" type="checkbox" defaultChecked={Boolean(pkg.videoGeneration)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          <label>Custom AI<input name="customAi" type="checkbox" defaultChecked={Boolean(pkg.customAi)} disabled={staff.role !== 'SUPER_ADMIN'} /></label>
          {staff.role === 'SUPER_ADMIN' ? <button type="submit">Save package</button> : null}
        </form>
      ))}
    </section>
  )
}

export function SubscriptionsPage() {
  const staff = useStaff()
  const [rows, setRows] = useState<Array<{ id: string; organizationId: string; packageId: string; status: string; seats: number }>>([])
  function load() { return api<{ subscriptions: typeof rows }>('/api/admin/subscriptions').then((body) => setRows(body.subscriptions)) }
  useEffect(() => { load().catch(() => undefined) }, [])
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
                  <select defaultValue={row.status} onChange={(event) => void api(`/api/admin/subscriptions/${row.id}`, { method: 'PATCH', body: JSON.stringify({ status: event.target.value }) }).then(() => load())}>
                    <option>trialing</option><option>active</option><option>past_due</option><option>canceled</option>
                  </select>
                ) : row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function UsagePage() {
  const [rows, setRows] = useState<Array<{ organizationId: string; kind: string; count: number }>>([])
  useEffect(() => { api<{ usage: typeof rows }>('/api/admin/usage').then((body) => setRows(body.usage)).catch(() => undefined) }, [])
  return (
    <section className="stack">
      <h1>Usage</h1>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Organization</th><th>Kind</th><th>Count</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.organizationId}-${row.kind}`}><td>{row.organizationId}</td><td>{row.kind}</td><td>{row.count}</td></tr>)}</tbody>
        </table>
      </div>
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

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [flags, setFlags] = useState({ platformKeySet: false, metaAppIdSet: false })
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ settings: Settings; platformKeySet: boolean; metaAppIdSet: boolean }>('/api/admin/settings').then((body) => {
      setSettings(body.settings)
      setFlags({ platformKeySet: body.platformKeySet, metaAppIdSet: body.metaAppIdSet })
    }).catch((cause) => setError(messageOf(cause)))
  }, [])
  async function save(patch: Partial<Settings>) {
    const body = await api<{ settings: Settings; platformKeySet: boolean; metaAppIdSet: boolean }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(patch) })
    setSettings(body.settings)
    setFlags({ platformKeySet: body.platformKeySet, metaAppIdSet: body.metaAppIdSet })
  }
  if (!settings) return <p>{error || 'Loading settings'}</p>
  return (
    <section className="stack">
      <h1>Site settings</h1>
      {error ? <p className="error">{error}</p> : null}
      <p>Platform text key: {flags.platformKeySet ? 'set' : 'not set'}. Meta app id: {flags.metaAppIdSet ? 'set' : 'not set'}.</p>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ general: { productName: String(form.get('productName')), logo: String(form.get('logo')), supportEmail: String(form.get('supportEmail')), publicSiteUrl: String(form.get('publicSiteUrl')), registrationOpen: form.get('registrationOpen') === 'on', maintenanceMessage: String(form.get('maintenanceMessage')) } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>General</h2>
        <label>Product<input name="productName" defaultValue={settings.general.productName} /></label>
        <label>Logo URL<input name="logo" defaultValue={settings.general.logo} /></label>
        <label>Support email<input name="supportEmail" defaultValue={settings.general.supportEmail} /></label>
        <label>Public site URL<input name="publicSiteUrl" defaultValue={settings.general.publicSiteUrl} /></label>
        <label>Registration open<input name="registrationOpen" type="checkbox" defaultChecked={settings.general.registrationOpen} /></label>
        <label>Maintenance message<textarea name="maintenanceMessage" defaultValue={settings.general.maintenanceMessage} /></label>
        <button type="submit">Save general</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ legal: { privacy: String(form.get('privacy')), terms: String(form.get('terms')), dataDeletion: String(form.get('dataDeletion')) } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Legal</h2>
        <label>Privacy<textarea name="privacy" defaultValue={settings.legal.privacy} rows={4} /></label>
        <label>Terms<textarea name="terms" defaultValue={settings.legal.terms} rows={4} /></label>
        <label>Data deletion<textarea name="dataDeletion" defaultValue={settings.legal.dataDeletion} rows={4} /></label>
        <button type="submit">Save legal</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ features: { scheduling: form.get('scheduling') === 'on', videoGeneration: form.get('videoGeneration') === 'on', inboxAutomation: form.get('inboxAutomation') === 'on', customAi: form.get('customAi') === 'on', signups: form.get('signups') === 'on' } }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Features</h2>
        {(['scheduling', 'videoGeneration', 'inboxAutomation', 'customAi', 'signups'] as const).map((key) => (
          <label key={key}>{key}<input name={key} type="checkbox" defaultChecked={settings.features[key]} /></label>
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
        <label>Starter<input name="starter" defaultValue={settings.ai.allowedModels.starter.join(', ')} /></label>
        <label>Growth<input name="growth" defaultValue={settings.ai.allowedModels.growth.join(', ')} /></label>
        <label>Pro<input name="pro" defaultValue={settings.ai.allowedModels.pro.join(', ')} /></label>
        <button type="submit">Save models</button>
      </form>
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void save({ instagram: { oauthCallbackUrl: String(form.get('oauthCallbackUrl')) }, email: { inviteTemplate: String(form.get('inviteTemplate')), resetTemplate: String(form.get('resetTemplate')) }, seo: { titleTemplate: String(form.get('titleTemplate')), siteDescription: String(form.get('siteDescription')), canonicalHost: String(form.get('canonicalHost')), defaultShareImage: String(form.get('defaultShareImage')) }, robots: String(form.get('robots')) }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>Instagram, email, SEO, robots</h2>
        <label>OAuth callback<input name="oauthCallbackUrl" defaultValue={settings.instagram.oauthCallbackUrl} /></label>
        <label>Invite template<textarea name="inviteTemplate" defaultValue={settings.email.inviteTemplate} /></label>
        <label>Reset template<textarea name="resetTemplate" defaultValue={settings.email.resetTemplate} /></label>
        <label>Title template<input name="titleTemplate" defaultValue={settings.seo.titleTemplate} /></label>
        <label>Site description<input name="siteDescription" defaultValue={settings.seo.siteDescription} /></label>
        <label>Canonical host<input name="canonicalHost" defaultValue={settings.seo.canonicalHost} /></label>
        <label>Share image<input name="defaultShareImage" defaultValue={settings.seo.defaultShareImage} /></label>
        <label>robots.txt<textarea name="robots" defaultValue={settings.robots} rows={5} /></label>
        <button type="submit">Save the rest</button>
      </form>
    </section>
  )
}

type SeoPage = { id: string; path: string; title: string; description: string; ogTitle: string; ogDescription: string; ogImage: string; indexed: boolean; inSitemap: boolean }

export function SeoPage() {
  const [pages, setPages] = useState<SeoPage[]>([])
  const [selected, setSelected] = useState('')
  const [robots, setRobots] = useState('')
  const [host, setHost] = useState('')
  const [redirects, setRedirects] = useState<Array<{ id: string; fromPath: string; toPath: string; statusCode: number }>>([])
  const [sets, setSets] = useState<Array<{ id: string; name: string; category: string; keywords: string[]; hashtags: string[] }>>([])
  const [error, setError] = useState('')
  const page = pages.find((item) => item.id === selected) ?? pages[0]
  function load() {
    return Promise.all([
      api<{ pages: SeoPage[] }>('/api/admin/seo/pages'),
      api<{ robots: string }>('/api/admin/seo/robots'),
      api<{ redirects: typeof redirects }>('/api/admin/seo/redirects'),
      api<{ sets: typeof sets }>('/api/admin/seo/sets'),
      api<{ settings: { seo: { canonicalHost: string } } }>('/api/admin/settings'),
    ]).then(([pageBody, robotBody, redirectBody, setBody, settings]) => {
      setPages(pageBody.pages)
      setRobots(robotBody.robots)
      setRedirects(redirectBody.redirects)
      setSets(setBody.sets)
      setHost(settings.settings.seo.canonicalHost)
    })
  }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <section className="stack">
      <h1>SEO</h1>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-scroll">
        <table>
          <tbody>{pages.map((item) => <tr key={item.id}><td><button className="secondary" type="button" onClick={() => setSelected(item.id)}>{item.path}</button></td><td>{item.title}</td><td>{item.indexed ? 'index' : 'noindex'}</td></tr>)}</tbody>
        </table>
      </div>
      {page ? (
        <form className="card stack" onSubmit={(event) => {
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
          <label>Title<input name="title" defaultValue={page.title} /></label>
          <label>Description<textarea name="description" defaultValue={page.description} /></label>
          <label>Open Graph title<input name="ogTitle" defaultValue={page.ogTitle} /></label>
          <label>Open Graph description<input name="ogDescription" defaultValue={page.ogDescription} /></label>
          <label>Indexed<input name="indexed" type="checkbox" defaultChecked={page.indexed} /></label>
          <label>In sitemap<input name="inSitemap" type="checkbox" defaultChecked={page.inSitemap} /></label>
          <button type="submit">Save page</button>
        </form>
      ) : null}
      <form className="card stack" onSubmit={(event) => { event.preventDefault(); void api('/api/admin/seo/robots', { method: 'PUT', body: JSON.stringify({ robots }) }).catch((cause) => setError(messageOf(cause))) }}>
        <h2>robots.txt</h2>
        <textarea value={robots} onChange={(event) => setRobots(event.target.value)} rows={6} />
        <button type="submit">Save robots</button>
      </form>
      <form className="card stack" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api('/api/admin/seo/redirects', { method: 'POST', body: JSON.stringify({ fromPath: form.get('fromPath'), toPath: form.get('toPath'), statusCode: 301 }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))
      }}>
        <h2>Redirects</h2>
        <ul>{redirects.map((redirect) => <li key={redirect.id}>{redirect.fromPath} → {redirect.toPath} <button type="button" onClick={() => void api(`/api/admin/seo/redirects/${redirect.id}`, { method: 'DELETE' }).then(() => load())}>Delete</button></li>)}</ul>
        <label>From<input name="fromPath" required /></label>
        <label>To<input name="toPath" required /></label>
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
        <ul>{sets.map((set) => <li key={set.id}>{set.name} · {set.category} · {(set.hashtags ?? []).join(' ')}</li>)}</ul>
        <label>Name<input name="name" required /></label>
        <label>Category<input name="category" required /></label>
        <label>Keywords<input name="keywords" placeholder="comma separated" /></label>
        <label>Hashtags<input name="hashtags" placeholder="up to 10, comma separated" /></label>
        <button type="submit">Add set</button>
      </form>
    </section>
  )
}

export function AuditPage() {
  const [logs, setLogs] = useState<Array<{ id: string; action: string; actorType: string; createdAt: string; organizationId: string | null }>>([])
  useEffect(() => { api<{ logs: typeof logs }>('/api/admin/audit').then((body) => setLogs(body.logs)).catch(() => undefined) }, [])
  return (
    <section className="stack">
      <h1>Audit</h1>
      <div className="table-scroll">
        <table>
          <tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString()}</td><td>{log.actorType}</td><td>{log.action}</td><td>{log.organizationId ?? ''}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}

export function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [error, setError] = useState('')
  function load() { return api<{ staff: Staff[] }>('/api/admin/staff').then((body) => setStaff(body.staff)) }
  useEffect(() => { load().catch((cause) => setError(messageOf(cause))) }, [])
  return (
    <section className="stack">
      <h1>Staff</h1>
      {error ? <p className="error">{error}</p> : null}
      <ul>{staff.map((person) => <li key={person.id}>{person.name} · {person.email} · {person.role}</li>)}</ul>
      <form className="stack card" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void api('/api/admin/staff', { method: 'POST', body: JSON.stringify({ name: form.get('name'), email: form.get('email'), password: form.get('password'), role: form.get('role') }) }).then(() => load()).catch((cause) => setError(messageOf(cause)))
      }}>
        <label>Name<input name="name" required /></label>
        <label>Email<input name="email" type="email" required /></label>
        <label>Password<input name="password" type="password" minLength={8} required /></label>
        <label>Role<select name="role"><option>SUPPORT</option><option>SUPER_ADMIN</option></select></label>
        <button type="submit">Add staff</button>
      </form>
    </section>
  )
}
