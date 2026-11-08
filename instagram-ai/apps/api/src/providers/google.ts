export type GoogleProfile = {
  sub: string
  email: string
  name: string
  emailVerified: boolean
}

export type GoogleCall = { method: string; [key: string]: unknown }

export interface GoogleAuth {
  calls: GoogleCall[]
  buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string
  exchange(input: { clientId: string; clientSecret: string; redirectUri: string; code: string }): Promise<GoogleProfile>
}

export class FakeGoogleAuth implements GoogleAuth {
  calls: GoogleCall[] = []
  profile: GoogleProfile = {
    sub: 'google-sub',
    email: 'google.user@example.com',
    name: 'Google User',
    emailVerified: true,
  }

  buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
    this.calls.push({ method: 'authorize', state: input.state })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', input.clientId)
    url.searchParams.set('redirect_uri', input.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', input.state)
    return url.toString()
  }

  async exchange(input: { clientId: string; clientSecret: string; redirectUri: string; code: string }): Promise<GoogleProfile> {
    this.calls.push({ method: 'exchange', code: input.code })
    if (!this.profile.emailVerified) throw new Error('Google did not verify this email')
    return this.profile
  }
}

export class RealGoogleAuth implements GoogleAuth {
  calls: GoogleCall[] = []

  constructor(private fetchImpl: typeof fetch = fetch) {}

  buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string }): string {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', input.clientId)
    url.searchParams.set('redirect_uri', input.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', input.state)
    url.searchParams.set('prompt', 'select_account')
    return url.toString()
  }

  async exchange(input: { clientId: string; clientSecret: string; redirectUri: string; code: string }): Promise<GoogleProfile> {
    const tokenResponse = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const token = await tokenResponse.json() as { id_token?: string; error?: string; error_description?: string }
    if (!tokenResponse.ok || !token.id_token) {
      throw new Error(token.error_description || token.error || 'Google did not return an identity token')
    }
    const infoResponse = await this.fetchImpl(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token.id_token)}`)
    const info = await infoResponse.json() as {
      aud?: string
      sub?: string
      email?: string
      email_verified?: string | boolean
      name?: string
      error?: string
      error_description?: string
    }
    const verified = info.email_verified === true || info.email_verified === 'true'
    if (!infoResponse.ok || info.aud !== input.clientId || !verified || !info.email || !info.sub) {
      throw new Error(info.error_description || info.error || 'Google did not verify this account')
    }
    return {
      sub: info.sub,
      email: info.email,
      name: info.name || info.email,
      emailVerified: true,
    }
  }
}
