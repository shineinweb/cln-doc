export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

let csrfToken = ''

export function setCsrf(token: string): void {
  csrfToken = token
  sessionStorage.setItem('ia_staff_csrf', token)
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!csrfToken) csrfToken = sessionStorage.getItem('ia_staff_csrf') ?? ''
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  if (csrfToken) headers.set('x-csrf-token', csrfToken)
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  const text = await response.text()
  let data: { error?: { code?: string; message?: string } } = {}
  if (text) {
    try { data = JSON.parse(text) as typeof data } catch { data = { error: { message: text } } }
  }
  if (!response.ok) throw new ApiError(data.error?.code ?? 'request_failed', data.error?.message ?? 'The request failed')
  return data as T
}
