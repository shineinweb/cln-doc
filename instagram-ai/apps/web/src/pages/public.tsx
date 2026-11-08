import { FormEvent, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { resolveRedirect } from '@instagram-ai/shared'
import { api, setClientSession } from '../lib/api'
import { Hint, Pager } from '../lib/form'
import { applyPageSeo, applyRecordSeo } from '../lib/seo'
import type { PackageInfo, PublicConfig, PublicPage } from '../lib/types'

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(minor / 100)
}

export function usePublicPage(path: string): { page: PublicPage | null; config: PublicConfig | null } {
  const [page, setPage] = useState<PublicPage | null>(null)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  useEffect(() => {
    let cancel = false
    Promise.all([
      api<{ pages: PublicPage[] }>(`/api/public/pages?path=${encodeURIComponent(path)}`),
      api<PublicConfig>('/api/public/config'),
    ]).then(([pages, nextConfig]) => {
      if (cancel) return
      const record = pages.pages[0]
      setConfig(nextConfig)
      if (record) {
        applyRecordSeo(record, nextConfig.canonicalHost)
        setPage(record)
      }
    }).catch(() => undefined)
    return () => { cancel = true }
  }, [path])
  return { page, config }
}

function SiteHeader({ config }: { config: PublicConfig | null }) {
  return (
    <header className="site-header">
      <Link to="/" className="wordmark">{config?.productName || 'Instagram AI'}</Link>
      <nav className="site-nav">
        <Link to="/pricing">Pricing</Link>
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/data-deletion">Data deletion</Link>
        <Link to="/login">Log in</Link>
        <Link className="button" to="/register">Create an account</Link>
      </nav>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <strong>Instagram AI</strong>
        <p>Drafts stay drafts until a person approves them. Publishing uses Meta’s official API.</p>
        <nav>
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/data-deletion">Data deletion</Link>
          <Link to="/login">Log in</Link>
          <Link to="/register">Create an account</Link>
          <Link to="/reset-password">Reset password</Link>
        </nav>
      </div>
    </footer>
  )
}

export function PublicLayout({ missing = false }: { missing?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [config, setConfig] = useState<PublicConfig | null>(null)
  useEffect(() => {
    api<PublicConfig>('/api/public/config').then(setConfig).catch(() => undefined)
    api<{ redirects: Array<{ fromPath: string; toPath: string; statusCode?: number }> }>('/api/public/redirects')
      .then(({ redirects }) => {
        const match = resolveRedirect(redirects, location.pathname)
        if (match) navigate(match.toPath, { replace: true })
      })
      .catch(() => undefined)
  }, [location.pathname, navigate])
  return (
    <div className="site">
      <SiteHeader config={config} />
      {config?.maintenanceMessage ? <div className="banner">{config.maintenanceMessage}</div> : null}
      <main className="site-main">{missing ? <h1>That page is not on this site</h1> : <Outlet />}</main>
      <SiteFooter />
    </div>
  )
}

function PackageCards({ packages }: { packages: PackageInfo[] }) {
  return (
    <div className="package-grid">
      {packages.map((pkg) => (
        <article className="package-card" key={pkg.id}>
          <h2>{pkg.name}</h2>
          <div className="price">{money(pkg.priceMinor, pkg.currency)}</div>
          <p>{pkg.description}</p>
          <p>{pkg.instagramAccounts} Instagram accounts · {pkg.seats} seats</p>
          <p>{pkg.monthlyAiGenerations} text · {pkg.monthlyImageGenerations} photos · {pkg.monthlyVideoGenerations} videos</p>
          <Link className="button" to="/register">Start with {pkg.name}</Link>
        </article>
      ))}
    </div>
  )
}

function PagedPackages() {
  const [packages, setPackages] = useState<PackageInfo[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    api<{ packages: PackageInfo[]; total: number; page: number }>(`/api/public/pricing?page=${page}`)
      .then((body) => { setPackages(body.packages); setTotal(body.total); setPage(body.page) })
      .catch(() => undefined)
  }, [page])
  if (!packages.length) return null
  return (
    <div className="stack">
      <PackageCards packages={packages} />
      <Pager page={page} total={total} onPage={setPage} label="Packages" />
    </div>
  )
}

export function HomePage() {
  usePublicPage('/')
  return (
    <div className="marketing">
      <section className="hero">
        <h1>Draft, preview, and approve each post.</h1>
        <p>Write the caption, look at the photo, carousel, Reel, or video, and send it only when someone on your team says yes.</p>
        <div className="row center">
          <Link className="button" to="/register">Start a trial</Link>
          <Link className="button secondary" to="/pricing">See packages</Link>
        </div>
        <div className="draft-preview" aria-hidden="true">
          <div className="draft-art">Morning light</div>
          <div className="draft-copy">
            <strong>Draft</strong>
            <p>The first pour of the day. Approve it before it goes live.</p>
            <span>Photo · waiting for approval</span>
          </div>
        </div>
      </section>
      <section className="site-section">
        <div className="format-grid">
          <article className="format-card photo"><h2>Photo</h2><p>A single still, from a reference photo or a generated frame.</p></article>
          <article className="format-card carousel"><h2>Carousel</h2><p>A short sequence for a story people swipe through.</p></article>
          <article className="format-card reel"><h2>Reel</h2><p>A vertical clip at 4, 8, or 12 seconds.</p></article>
          <article className="format-card video"><h2>Video</h2><p>A wide clip at 8, 15, or 30 seconds.</p></article>
        </div>
      </section>
      <section className="promise">
        <div className="promise-grid">
          <article><h2>Approve before publish</h2><p>Nothing is sent until a person on the account approves the draft.</p></article>
          <article><h2>Meta’s official API only</h2><p>Publishing, comments, and messages go through Instagram’s official API.</p></article>
          <article><h2>No follow or like automation</h2><p>This product does not follow, like, or unfollow accounts.</p></article>
        </div>
      </section>
      <section className="site-section inbox-block">
        <div>
          <h2>Comments and messages in one inbox</h2>
          <p>See the comment, draft a reply, and send it when you are ready. Messages stay inside the window Instagram already allows. A person can pause automation on any thread.</p>
        </div>
        <ol className="inbox-list">
          <li>A comment arrives on a post you published.</li>
          <li>The inbox keeps the draft next to the original words.</li>
          <li>You reply, hide, or leave it for someone else.</li>
        </ol>
      </section>
      <section className="site-section">
        <h2>How a post gets out</h2>
        <ol className="steps">
          <li><span>1</span><div><strong>Describe it</strong><p>Pick Photo, Carousel, Reel, or Video, and add the instructions the draft should follow.</p></div></li>
          <li><span>2</span><div><strong>Preview it</strong><p>Look at the image or the clip, including a reference photo when you have one.</p></div></li>
          <li><span>3</span><div><strong>Approve it</strong><p>Edit the caption and hashtags. Approval is a separate step from publishing.</p></div></li>
          <li><span>4</span><div><strong>Publish it</strong><p>Send it through Meta’s official API, or put it on the calendar.</p></div></li>
        </ol>
      </section>
      <section className="site-section">
        <h2>Packages</h2>
        <PagedPackages />
      </section>
      <section className="site-section">
        <div className="trial-band">
          <h2>Start a Starter trial</h2>
          <p>Draft and preview a post before you connect an Instagram account.</p>
          <Link className="button" to="/register">Create an account</Link>
        </div>
      </section>
    </div>
  )
}

export function PricingPage() {
  const { page } = usePublicPage('/pricing')
  return (
    <section className="site-section stack">
      <h1>{page?.title || 'Pricing'}</h1>
      <p>{page?.description}</p>
      <PagedPackages />
    </section>
  )
}

export function LegalPage({ path }: { path: string }) {
  const { page } = usePublicPage(path)
  return (
    <article className="site-section narrow stack">
      <h1>{page?.title}</h1>
      <p>{page?.description}</p>
      <p>{page?.body}</p>
    </article>
  )
}

function GoogleButton() {
  const [params] = useSearchParams()
  return (
    <div className="stack">
      {params.get('google') === 'missing' ? <p className="error">Add the Google client id and secret in admin settings before using Continue with Google.</p> : null}
      <a className="button secondary" href="/api/auth/google/start">Continue with Google</a>
    </div>
  )
}

export function LoginPage() {
  const { page } = usePublicPage('/login')
  const navigate = useNavigate()
  const [error, setError] = useState('')
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const body = await api<{ csrfToken: string; organizations: Array<{ id: string }> }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      setClientSession({ csrfToken: body.csrfToken, organizationId: body.organizations[0]?.id ?? '' })
      navigate('/app')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed')
    }
  }
  return (
    <form className="stack card narrow auth-card" onSubmit={onSubmit}>
      <h1>{page?.title || 'Log in'}</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Email<Hint>The email on your account.</Hint><input name="email" type="email" required /></label>
      <label>Password<Hint>At least 8 characters.</Hint><input name="password" type="password" required minLength={8} /></label>
      <button type="submit">Log in</button>
      <GoogleButton />
      <Link to="/register">Create an account</Link>
      <Link to="/reset-password">Forgot password</Link>
    </form>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    applyPageSeo({ title: 'Create an account', description: 'Start a Starter trial.', indexed: true })
  }, [])
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const body = await api<{ csrfToken: string; organization: { id: string } }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          organizationName: form.get('organizationName'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      })
      setClientSession({ csrfToken: body.csrfToken, organizationId: body.organization.id })
      navigate('/app')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed')
    }
  }
  return (
    <form className="stack card narrow auth-card" onSubmit={onSubmit}>
      <h1>Create an account</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Your name<Hint>The name teammates see.</Hint><input name="name" required /></label>
      <label>Organization<Hint>The workspace name for this account.</Hint><input name="organizationName" required /></label>
      <label>Email<Hint>You will sign in with this email.</Hint><input name="email" type="email" required /></label>
      <label>Password<Hint>At least 8 characters.</Hint><input name="password" type="password" required minLength={8} /></label>
      <button type="submit">Start the trial</button>
      <GoogleButton />
    </form>
  )
}

export function ResetPage() {
  const [params] = useSearchParams()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    applyPageSeo({ title: 'Reset password', description: 'Choose a new password.', indexed: true })
  }, [])
  async function requestLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = await api<{ ok: boolean; resetToken?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email') }),
    })
    setMessage(body.resetToken ? `Development reset token: ${body.resetToken}` : 'If that email exists, a reset link was sent.')
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: form.get('token'), password: form.get('password') }),
      })
      setMessage('Password updated. You can log in.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reset failed')
    }
  }
  return (
    <div className="site-section narrow stack">
      <h1>Reset password</h1>
      {message ? <p className="notice">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <form className="stack card" onSubmit={requestLink}>
        <label>Email<Hint>The email on the account that needs a reset.</Hint><input name="email" type="email" required /></label>
        <button type="submit">Send reset</button>
      </form>
      <form className="stack card" onSubmit={reset}>
        <label>Reset token<Hint>The token from the reset message.</Hint><input name="token" defaultValue={params.get('token') ?? ''} required /></label>
        <label>New password<Hint>At least 8 characters. This replaces the old password.</Hint><input name="password" type="password" minLength={8} required /></label>
        <button type="submit">Update password</button>
      </form>
    </div>
  )
}
