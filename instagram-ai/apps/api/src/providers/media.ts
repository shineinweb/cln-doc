import type { Env } from '../env'

export type MediaRequest = {
  prompt: string
  apiKey?: string
}

export interface MediaProvider {
  generateImage(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }>
  generateVideo(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }>
}

export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

export class FakeMediaProvider implements MediaProvider {
  imageCalls = 0
  videoCalls = 0
  prompts: string[] = []

  async generateImage(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }> {
    this.imageCalls += 1
    this.prompts.push(input.prompt)
    return { bytes: TINY_PNG, mimeType: 'image/png' }
  }

  async generateVideo(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }> {
    this.videoCalls += 1
    this.prompts.push(input.prompt)
    return { bytes: Buffer.from('fake-mp4'), mimeType: 'video/mp4' }
  }
}

export class HttpMediaProvider implements MediaProvider {
  constructor(
    private env: Env,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async generateImage(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }> {
    const key = input.apiKey || this.env.MEDIA_PROVIDER_KEY
    const response = await this.fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: input.prompt, size: '1024x1024' }),
    })
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    if (!response.ok || !payload.data?.[0]?.b64_json) {
      throw new Error(payload.error?.message || 'Image provider failed')
    }
    return { bytes: Buffer.from(payload.data[0].b64_json, 'base64'), mimeType: 'image/png' }
  }

  async generateVideo(input: MediaRequest): Promise<{ bytes: Buffer; mimeType: string }> {
    if (!this.env.VIDEO_PROVIDER_URL) throw new Error('Video provider URL is not configured')
    const response = await this.fetchImpl(this.env.VIDEO_PROVIDER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.apiKey || this.env.MEDIA_PROVIDER_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prompt: input.prompt }),
    })
    if (!response.ok) throw new Error('Video provider failed')
    const bytes = Buffer.from(await response.arrayBuffer())
    return { bytes, mimeType: 'video/mp4' }
  }
}

export function createMediaProvider(env: Env): MediaProvider {
  if (env.MEDIA_PROVIDER_KEY || env.VIDEO_PROVIDER_URL) return new HttpMediaProvider(env)
  return new FakeMediaProvider()
}
