import { FormEvent, useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { resolveRedirect } from '@instagram-ai/shared'
import { api, setClientSession } from '../lib/api'
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
    <>
      <header className="public-header">
        <Link to="/"><strong>{config?.productName || 'Instagram AI'}</strong></Link>
        <nav className="public-nav">
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/data-deletion">Data deletion</Link>
          <Link to="/login">Log in</Link>
        </nav>
      </header>
      {config?.maintenanceMessage ? <div className="banner">{config.maintenanceMessage}</div> : null}
      <main className="public-main">{missing ? <h1>That page is not on this site</h1> : <Outlet />}</main>
    </>
  )
}

export function HomePage() {
  const { page } = usePublicPage('/')
  return (
    <section className="stack">
      <h1>{page?.title || 'Instagram AI'}</h1>
      <p>{page?.description}</p>
      <p>Write a post, preview the photo or Reel, and approve it before anything is published. Likes, follows, and unfollows are not part of this product.</p>
      <div className="row">
        <Link className="button" to="/register">Start a trial</Link>
        <Link className="button secondary" to="/pricing">See packages</Link>
      </div>
    </section>
  )
}

export function PricingPage() {
  const { page } = usePublicPage('/pricing')
  const [packages, setPackages] = useState<PackageInfo[]>([])
  useEffect(() => {
    api<{ packages: PackageInfo[] }>('/api/public/pricing').then((body) => setPackages(body.packages)).catch(() => undefined)
  }, [])
  return (
    <section className="stack">
      <h1>{page?.title || 'Pricing'}</h1>
      <p>{page?.description}</p>
      <div className="cards">
        {packages.map((pkg) => (
          <article className="card" key={pkg.id}>
            <h2>{pkg.name}</h2>
            <div className="price">{money(pkg.priceMinor, pkg.currency)}</div>
            <p>{pkg.description}</p>
            <p>{pkg.instagramAccounts} Instagram accounts · {pkg.seats} seats</p>
            <p>{pkg.monthlyAiGenerations} text · {pkg.monthlyImageGenerations} photos · {pkg.monthlyVideoGenerations} videos</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export function LegalPage({ path }: { path: string }) {
  const { page } = usePublicPage(path)
  return (
    <article className="stack">
      <h1>{page?.title}</h1>
      <p>{page?.description}</p>
      <p>{page?.body}</p>
    </article>
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
    <form className="stack card" onSubmit={onSubmit}>
      <h1>{page?.title || 'Log in'}</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" required minLength={8} /></label>
      <button type="submit">Log in</button>
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
    <form className="stack card" onSubmit={onSubmit}>
      <h1>Create an account</h1>
      {error ? <p className="error">{error}</p> : null}
      <label>Your name<input name="name" required /></label>
      <label>Organization<input name="organizationName" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Password<input name="password" type="password" required minLength={8} /></label>
      <button type="submit">Start the trial</button>
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
    <div className="stack">
      <h1>Reset password</h1>
      {message ? <p className="notice">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <form className="stack card" onSubmit={requestLink}>
        <label>Email<input name="email" type="email" required /></label>
        <button type="submit">Send reset</button>
      </form>
      <form className="stack card" onSubmit={reset}>
        <label>Reset token<input name="token" defaultValue={params.get('token') ?? ''} required /></label>
        <label>New password<input name="password" type="password" minLength={8} required /></label>
        <button type="submit">Update password</button>
      </form>
    </div>
  )
}
