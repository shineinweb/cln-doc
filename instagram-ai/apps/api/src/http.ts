import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Env } from './env'

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export function sessionCookie(name: string, value: string, maxAgeSec: number, secure: boolean): string {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ]
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

export function browserOrigin(req: Request, env: Pick<Env, 'PORT'>): string | undefined {
  const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim()
  if (!host || host.endsWith(`:${env.PORT}`)) return undefined
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim()
  return `${proto}://${host}`
}

export function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}
