import { ApiError } from '../errors'
import { isDisplayableImage } from '../providers/media'

const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])
export const SAMPLE_IMAGE_MAX_BYTES = 25 * 1024 * 1024

function mimeFromContentType(header: string | null): string | null {
  if (!header) return null
  const raw = header.split(';')[0]?.trim().toLowerCase() ?? ''
  if (raw === 'image/jpg') return 'image/jpeg'
  return raw || null
}

function filenameFromUrl(url: URL, mimeType: string): string {
  const base = url.pathname.split('/').pop() || 'sample'
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80) || 'sample'
  if (/\.(png|jpe?g|webp)$/i.test(clean)) return clean
  if (mimeType === 'image/png') return `${clean}.png`
  if (mimeType === 'image/webp') return `${clean}.webp`
  return `${clean}.jpg`
}

function looksLikeHtml(bytes: Buffer): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 256)).toString('utf8').trimStart().toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<head') || head.startsWith('<body')
}

export async function fetchReferenceImage(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    throw new ApiError(400, 'validation', 'Sample URL must be an http or https image address')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ApiError(400, 'validation', 'Sample URL must be an http or https image address')
  }

  let response: Response
  try {
    response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/*;q=0.8' },
    })
  } catch {
    throw new ApiError(400, 'validation', 'Could not fetch the sample image URL')
  }

  if (!response.ok) {
    throw new ApiError(400, 'validation', 'Could not fetch the sample image URL')
  }

  const mimeType = mimeFromContentType(response.headers.get('content-type'))
  if (!mimeType || mimeType.includes('html') || mimeType === 'text/plain' || mimeType === 'application/xhtml+xml') {
    throw new ApiError(400, 'validation', 'Sample URL must point to a PNG, JPEG, or WebP image, not a web page')
  }
  if (!IMAGE.has(mimeType)) {
    throw new ApiError(400, 'validation', 'Sample URL must point to a PNG, JPEG, or WebP image')
  }

  const lengthHeader = response.headers.get('content-length')
  if (lengthHeader && Number(lengthHeader) > SAMPLE_IMAGE_MAX_BYTES) {
    throw new ApiError(413, 'validation', 'Sample image is too large')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new ApiError(400, 'validation', 'Could not fetch the sample image URL')
  }

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > SAMPLE_IMAGE_MAX_BYTES) {
      try { reader.cancel() } catch { /* ignore */ }
      throw new ApiError(413, 'validation', 'Sample image is too large')
    }
    chunks.push(value)
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  if (!buffer.length) {
    throw new ApiError(400, 'validation', 'Sample URL did not return an image')
  }
  if (looksLikeHtml(buffer) || !isDisplayableImage(buffer, mimeType)) {
    throw new ApiError(400, 'validation', 'Sample URL must point to a PNG, JPEG, or WebP image, not a web page')
  }

  return {
    buffer,
    mimeType,
    filename: filenameFromUrl(parsed, mimeType),
  }
}
