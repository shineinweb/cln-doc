import { isOpenAiVideoEndpoint } from '../settings'
import { compositeBrandOntoClip, planLocalAd, renderLocalAd, spokenScript } from './local-ad'
import { ensureVoiceover, type VoiceoverOptions } from './voice'

export const RUNWAY_VERSION = '2024-11-06'
export const RUNWAY_ORIGIN = 'https://api.dev.runwayml.com'

const REEL_DURATION: Record<number, number> = { 4: 4, 8: 8, 12: 10 }
const VIDEO_DURATION: Record<number, number> = { 8: 8, 15: 10, 30: 10 }

export type VideoRoute = 'provider' | 'runway' | 'local'

export function chooseVideoRoute(input: {
  providerUrl: string | null
  runwayKey: string | null
  providerEnabled?: boolean
  runwayEnabled?: boolean
}): VideoRoute {
  if (input.providerUrl && input.providerEnabled !== false) return 'provider'
  if (input.runwayKey && input.runwayEnabled !== false) return 'runway'
  return 'local'
}

/** Why a stored provider was skipped, or null when nothing stored is switched off. */
export function videoOffNotice(input: {
  providerUrl: string | null
  runwayKey: string | null
  providerEnabled?: boolean
  runwayEnabled?: boolean
}): string | null {
  const off: string[] = []
  if (input.runwayKey && input.runwayEnabled === false) off.push('Runway')
  if (input.providerUrl && input.providerEnabled === false) off.push('The video provider')
  if (!off.length) return null
  const names = off.length === 2 ? 'Runway and the video provider are' : off[0] === 'Runway' ? 'Runway is' : 'The video provider is'
  return `${names} turned off by the admin`
}

export function mapRunwayDuration(format: 'reel' | 'video', length: number): number {
  const table = format === 'reel' ? REEL_DURATION : VIDEO_DURATION
  const mapped = table[length]
  if (!mapped) throw new Error('That length is not available')
  return mapped
}

export function runwayRatio(format: 'reel' | 'video'): '720:1280' | '1280:720' {
  return format === 'reel' ? '720:1280' : '1280:720'
}

const MARKDOWN_TIMESTAMP = /\*{0,2}\d{1,2}:\d{2}\s*[–—-]\s*\d{1,2}:\d{2}\*{0,2}\s*[–—-]?\s*/g

export function runwayPrompt(description: string, instructions: string): string {
  const text = [description, instructions]
    .map(plainPrompt)
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return (text || 'A brand video').slice(0, 1000)
}

function plainPrompt(value: string): string {
  return value
    .replace(MARKDOWN_TIMESTAMP, '')
    .replace(/\*\*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export function redactProviderMessage(message: string, secrets: Array<string | null | undefined>): string {
  let text = message.replace(/\s+/g, ' ').trim()
  for (const secret of secrets) {
    const value = secret?.trim()
    if (value && value.length >= 6) text = text.split(value).join('[redacted]')
  }
  return text
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk|key)_[A-Za-z0-9_-]{6,}\b/g, '[redacted]')
    .slice(0, 400)
}

export type ClipRequest = {
  format: 'reel' | 'video'
  length: number
  description: string
  instructions: string
  callToAction: string | null
  caption: string
  reference: { bytes: Buffer; mimeType: string } | null
  runwayKey: string | null
  providerUrl: string | null
  runwayEnabled?: boolean
  providerEnabled?: boolean
  openaiEnabled?: boolean
  openaiKey?: string | null
  brandColor?: string | null
  logo?: Buffer | null
  brandLine?: string | null
  tagline?: string | null
  services?: string[]
}

export type BrandComposite = (
  bytes: Buffer,
  input: { format: 'reel' | 'video'; line: string; logo: Buffer | null; color: string | null },
) => Promise<Buffer>

export function oneBrandLine(brandLine: string | null | undefined, description: string): string {
  const preferred = (brandLine ?? '').split(/\r?\n/).map((part) => part.trim()).find(Boolean)
  const fallback = description.split(/\r?\n/).map((part) => part.trim()).find(Boolean)
  return (preferred || fallback || 'Brand').replace(/\s+/g, ' ').slice(0, 40)
}

export type ClipResult = { bytes: Buffer; mimeType: string; route: VideoRoute; notice?: string }

export async function produceClip(
  request: ClipRequest,
  fetchImpl: typeof fetch,
  composite: BrandComposite = compositeBrandOntoClip,
): Promise<ClipResult> {
  const route = chooseVideoRoute({
    providerUrl: request.providerUrl,
    runwayKey: request.runwayKey,
    providerEnabled: request.providerEnabled,
    runwayEnabled: request.runwayEnabled,
  })
  const plan = planLocalAd({
    format: request.format,
    length: request.length,
    description: request.description,
    instructions: request.instructions,
    callToAction: request.callToAction,
    caption: request.caption,
    hasReference: Boolean(request.reference),
    brandName: oneBrandLine(request.brandLine, request.description),
    tagline: request.tagline,
    services: request.services,
  })
  const spoken = spokenScript(plan)
  const voice: VoiceoverOptions = { apiKey: request.openaiKey, enabled: request.openaiEnabled, fetchImpl }
  const local = () => designedLocal(request, plan, spoken, voice)
  if (route === 'provider') {
    try {
      const bytes = await requestProvider(request.providerUrl as string, {
        script: runwayPrompt(request.description, request.instructions) || spoken,
        format: request.format,
        length: request.length,
      }, fetchImpl)
      return { bytes: await ensureVoiceover(bytes, spoken, voice), mimeType: 'video/mp4', route }
    } catch (error) {
      const reason = redactProviderMessage(error instanceof Error ? error.message : 'Video provider failed', [request.providerUrl])
      const fallback = await local()
      fallback.notice = `The video provider could not render the video: ${reason} This preview is the local designed ad.`
      return fallback
    }
  }
  if (route === 'runway') {
    try {
      const raw = await requestRunway(request, fetchImpl)
      const burned = await composite(raw, {
        format: request.format,
        line: oneBrandLine(request.brandLine, request.description),
        logo: request.logo ?? null,
        color: request.brandColor ?? null,
      })
      return { bytes: await ensureVoiceover(burned, spoken, voice), mimeType: 'video/mp4', route }
    } catch (error) {
      const reason = redactProviderMessage(error instanceof Error ? error.message : 'Runway could not render the video', [request.runwayKey])
      const fallback = await local()
      fallback.notice = `Runway could not render the video: ${reason} This preview is the local designed ad.`
      return fallback
    }
  }
  return local()
}

async function designedLocal(
  request: ClipRequest,
  plan: ReturnType<typeof planLocalAd>,
  spoken: string,
  voice: VoiceoverOptions,
): Promise<ClipResult> {
  const silent = await renderLocalAd(plan, request.reference?.bytes ?? null, {
    color: request.brandColor,
    logo: request.logo,
  })
  return { bytes: await ensureVoiceover(silent, spoken, voice), mimeType: 'video/mp4', route: 'local' }
}

async function requestProvider(
  url: string,
  body: { script: string; format: 'reel' | 'video'; length: number },
  fetchImpl: typeof fetch,
): Promise<Buffer> {
  if (isOpenAiVideoEndpoint(url)) throw new Error('OpenAI video generation is not available')
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'video/mp4, application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(redactProviderMessage(detail || 'Video provider failed', [url]))
  }
  const type = response.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const payload = await response.json() as { url?: string; videoUrl?: string; b64?: string; b64_json?: string }
    if (payload.b64) return Buffer.from(payload.b64, 'base64')
    if (payload.b64_json) return Buffer.from(payload.b64_json, 'base64')
    const remote = payload.url || payload.videoUrl
    if (!remote) throw new Error('Video provider did not return a video')
    if (isOpenAiVideoEndpoint(remote)) throw new Error('OpenAI video generation is not available')
    const file = await fetchImpl(remote)
    if (!file.ok) throw new Error('Video provider did not return a video')
    return Buffer.from(await file.arrayBuffer())
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (!bytes.length) throw new Error('Video provider returned an empty file')
  return bytes
}

async function requestRunway(request: ClipRequest, fetchImpl: typeof fetch): Promise<Buffer> {
  const key = request.runwayKey as string
  const image = request.reference
  const path = image ? '/v1/image_to_video' : '/v1/text_to_video'
  const promptText = runwayPrompt(request.description, request.instructions)
  const body: Record<string, unknown> = {
    model: 'gen4.5',
    promptText,
    ratio: runwayRatio(request.format),
    duration: mapRunwayDuration(request.format, request.length),
  }
  if (image) {
    body.promptImage = [{
      uri: `data:${image.mimeType || 'image/png'};base64,${image.bytes.toString('base64')}`,
      position: 'first',
    }]
  }
  const created = await fetchImpl(`${RUNWAY_ORIGIN}${path}`, {
    method: 'POST',
    headers: runwayHeaders(key),
    body: JSON.stringify(body),
  })
  const createdBody = await created.json().catch(() => null) as { id?: string; error?: unknown; message?: unknown; failure?: unknown } | null
  if (!created.ok || !createdBody?.id) {
    throw new Error(runwayMessage(createdBody) || 'Runway did not start a video')
  }
  const outputUrl = await pollRunway(createdBody.id, key, fetchImpl)
  if (isOpenAiVideoEndpoint(outputUrl)) throw new Error('OpenAI video generation is not available')
  const file = await fetchImpl(outputUrl)
  if (!file.ok) throw new Error('Runway did not return a video')
  const bytes = Buffer.from(await file.arrayBuffer())
  if (!bytes.length) throw new Error('Runway did not return a video')
  return bytes
}

async function pollRunway(id: string, key: string, fetchImpl: typeof fetch): Promise<string> {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const response = await fetchImpl(`${RUNWAY_ORIGIN}/v1/tasks/${id}`, { headers: runwayHeaders(key) })
    const body = await response.json().catch(() => null) as { status?: string; output?: string[] | string; failure?: unknown; error?: unknown } | null
    if (!response.ok || !body) throw new Error(runwayMessage(body) || 'Runway task failed')
    if (body.status === 'SUCCEEDED') {
      const output = Array.isArray(body.output) ? body.output[0] : body.output
      if (!output) throw new Error('Runway did not return a video')
      return output
    }
    if (body.status === 'FAILED' || body.status === 'CANCELED' || body.status === 'CANCELLED') {
      throw new Error(runwayMessage(body) || 'Runway could not render the video')
    }
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  throw new Error('Runway took too long to render the video')
}

function runwayMessage(body: { error?: unknown; message?: unknown; failure?: unknown; issues?: unknown } | null): string {
  if (!body) return ''
  const issues = Array.isArray(body.issues)
    ? body.issues.flatMap((issue) => {
      if (!issue || typeof issue !== 'object' || !('message' in issue)) return []
      const message = (issue as { message?: unknown }).message
      return typeof message === 'string' && message.trim() ? [message.trim()] : []
    })
    : []
  if (issues.length) return issues.join(' ')
  for (const pick of [body.failure, body.error, body.message]) {
    if (typeof pick === 'string' && pick.trim()) return pick.trim()
    if (pick && typeof pick === 'object' && 'message' in pick && typeof (pick as { message?: unknown }).message === 'string') {
      const message = (pick as { message: string }).message.trim()
      if (message) return message
    }
  }
  return ''
}

function runwayHeaders(key: string): Record<string, string> {
  return {
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    'X-Runway-Version': RUNWAY_VERSION,
  }
}
