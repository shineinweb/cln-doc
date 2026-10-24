import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const key = (await scryptAsync(password, salt, 32)) as Buffer
  return `scrypt$${salt}$${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const key = (await scryptAsync(password, salt, 32)) as Buffer
  const left = Buffer.from(hash, 'hex')
  if (left.length !== key.length) return false
  return timingSafeEqual(left, key)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function encryptString(plain: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}.${tag.toString('hex')}.${encrypted.toString('hex')}`
}

export function decryptString(payload: string, keyHex: string): string {
  const [ivHex, tagHex, dataHex] = payload.split('.')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Ciphertext is malformed')
  const key = Buffer.from(keyHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return plain.toString('utf8')
}

function hmacHex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

export function signStripePayload(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmacHex(secret, `${timestamp}.${payload}`)}`
}

export function verifyStripeSignature(
  secret: string,
  payload: string,
  header: string | undefined,
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key, value]
    }),
  )
  const timestamp = parts.t
  const signature = parts.v1
  if (!timestamp || !signature) return false
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp))
  if (!Number.isFinite(age) || age > toleranceSec) return false
  return safeEqual(hmacHex(secret, `${timestamp}.${payload}`), signature)
}

export function verifyMetaSignature(secret: string, raw: Buffer, header: string | undefined): boolean {
  if (!secret || !header) return false
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`
  return safeEqual(expected, header)
}
