export class ApiError extends Error {
  code: string
  status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let csrfToken = ''
let organizationId = ''

export function setClientSession(next: { csrfToken?: string; organizationId?: string }): void {
  if (next.csrfToken) csrfToken = next.csrfToken
  if (next.organizationId !== undefined) organizationId = next.organizationId
}

export function clientOrganizationId(): string {
  return organizationId
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (csrfToken) headers.set('x-csrf-token', csrfToken)
  if (organizationId) headers.set('x-organization-id', organizationId)
  const response = await fetch(path, { ...init, headers, credentials: 'include' })
  const text = await response.text()
  let data: { error?: { code?: string; message?: string } } = {}
  if (text) {
    try {
      data = JSON.parse(text) as typeof data
    } catch {
      data = { error: { message: text } }
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status, data.error?.code ?? 'request_failed', data.error?.message ?? 'The request failed')
  }
  return data as T
}
