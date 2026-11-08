import { spawnSync } from 'node:child_process'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/env'
import {
  HttpMediaProvider,
  buildLocalMarketingPng,
  isDisplayableImage,
  marketingImagePrompt,
  parseServiceList,
  renderLocalMarketingPoster,
  TINY_PNG,
} from '../src/providers/media'
import { createPost, register, staffLogin, testApp } from './helpers'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

type Decoded = { width: number; height: number; channels: number; data: Buffer }

function decodePng(bytes: Buffer): Decoded {
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  const colorType = bytes[25]!
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (!channels || bytes[24] !== 8) throw new Error(`unsupported png colorType ${colorType}`)
  const idat: Buffer[] = []
  for (let offset = 8; offset + 8 <= bytes.length;) {
    const len = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    if (type === 'IDAT') idat.push(bytes.subarray(offset + 8, offset + 8 + len))
    offset += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x]!
      const left = x >= channels ? out[y * stride + x - channels]! : 0
      const up = y > 0 ? out[(y - 1) * stride + x]! : 0
      const upLeft = y > 0 && x >= channels ? out[(y - 1) * stride + x - channels]! : 0
      let value = cur
      if (filter === 1) value = cur + left
      else if (filter === 2) value = cur + up
      else if (filter === 3) value = cur + ((left + up) >> 1)
      else if (filter === 4) {
        const p = left + up - upLeft
        const pa = Math.abs(p - left)
        const pb = Math.abs(p - up)
        const pc = Math.abs(p - upLeft)
        value = cur + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)
      }
      out[y * stride + x] = value & 255
    }
  }
  return { width, height, channels, data: out }
}

function pixel(img: Decoded, nx: number, ny: number): [number, number, number] {
  const x = Math.min(img.width - 1, Math.floor(nx * img.width))
  const y = Math.min(img.height - 1, Math.floor(ny * img.height))
  const i = (y * img.width + x) * img.channels
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]
}

function region(img: Decoded, x0: number, y0: number, x1: number, y1: number, test: (rgb: [number, number, number]) => boolean): number {
  let hit = 0
  let total = 0
  for (let y = Math.floor(y0 * img.height); y < Math.floor(y1 * img.height); y += 2) {
    for (let x = Math.floor(x0 * img.width); x < Math.floor(x1 * img.width); x += 2) {
      const i = (y * img.width + x) * img.channels
      total += 1
      if (test([img.data[i]!, img.data[i + 1]!, img.data[i + 2]!])) hit += 1
    }
  }
  return hit / total
}

const lum = (rgb: [number, number, number]) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
const BRAND_GREEN = '#8aa94a'

const pngOk = () => Response.json({ data: [{ b64_json: TINY_PNG.toString('base64') }] })

function mockFetch(responder: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    return responder(url, init)
  }) as typeof fetch
  return { calls, impl }
}

const brandInput = {
  brandName: 'CodFex',
  description: 'CodFex Web Development and graphic design',
  businessDescription: 'Web programming and graphic design agency',
  productsAndServices: 'Web Programming, Graphic Design, Responsive Websites',
  voiceAndTone: 'Confident and friendly',
  targetAudience: 'Small businesses',
  primaryColor: '#2F6BFF',
  instructions: 'Show a team at their desks, dark navy look',
  callToAction: 'Get Started',
  hasLogo: true,
}

describe('structured OpenAI poster prompt', () => {
  it('carries brand, colors, instructions, services and the poster layout', () => {
    const prompt = marketingImagePrompt(brandInput)
    expect(prompt).toContain('CodFex')
    expect(prompt).toContain('#2F6BFF')
    expect(prompt).toContain('Show a team at their desks, dark navy look')
    expect(prompt).toContain('Web programming and graphic design agency')
    expect(prompt).toMatch(/Web Programming, Graphic Design, Responsive Websites/)
    expect(prompt).toMatch(/REQUIRED POSTER LAYOUT/)
    expect(prompt).toMatch(/1\. LOGO/)
    expect(prompt).toMatch(/HERO SCENE/)
    expect(prompt).toMatch(/SERVICES ROW/)
    expect(prompt).toMatch(/CTA FOOTER/)
    expect(prompt).toContain('"Get Started"')
    expect(prompt).toMatch(/Do NOT create a cartoon/)
    expect(prompt.length).toBeGreaterThan(1800)
  })

  it('tells the model how to use an attached sample and logo', () => {
    const both = marketingImagePrompt({ ...brandInput, hasReference: true })
    expect(both).toMatch(/Attached image 1 is the brand sample/)
    expect(both).toMatch(/Attached image 2 is the official CodFex logo/)
    const logoOnly = marketingImagePrompt(brandInput)
    expect(logoOnly).toMatch(/Attached image 1 is the official CodFex logo/)
  })

  it('splits free-text services into chip labels', () => {
    expect(parseServiceList('Web Programming, Graphic Design and Hosting; SEO')).toEqual([
      'Web Programming', 'Graphic Design', 'Hosting', 'SEO',
    ])
    expect(parseServiceList('')).toEqual([])
  })
})

describe('OpenAI image path', () => {
  const env = loadEnv()

  it('calls image generation with the long structured prompt when a key is saved', async () => {
    const prompt = marketingImagePrompt(brandInput)
    const fetcher = mockFetch(() => pngOk())
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({ prompt, apiKey: 'sk-test-key', brand: { name: 'CodFex' } })

    expect(fetcher.calls).toHaveLength(1)
    const call = fetcher.calls[0]!
    expect(call.url).toBe('https://api.openai.com/v1/images/generations')
    expect((call.init.headers as Record<string, string>).authorization).toBe('Bearer sk-test-key')
    const body = JSON.parse(String(call.init.body)) as { prompt: string; size: string; model: string }
    expect(body.prompt).toBe(prompt)
    expect(body.prompt).toMatch(/REQUIRED POSTER LAYOUT/)
    expect(body.size).toBe('1024x1024')
    expect(result.bytes.equals(TINY_PNG)).toBe(true)
    expect(result.notice).toBeUndefined()
  })

  it('sends the sample and the logo as guiding images through image edit, not a local card', async () => {
    const prompt = marketingImagePrompt({ ...brandInput, hasReference: true })
    const sample = Buffer.concat([TINY_PNG, Buffer.from('sample')])
    const logo = Buffer.concat([TINY_PNG, Buffer.from('logo')])
    const edited = Buffer.concat([TINY_PNG, Buffer.from('edited')])
    const fetcher = mockFetch(() => Response.json({ data: [{ b64_json: edited.toString('base64') }] }))
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt,
      apiKey: 'sk-test-key',
      reference: { bytes: sample, mimeType: 'image/png' },
      brand: { name: 'CodFex', logo },
    })

    expect(fetcher.calls).toHaveLength(1)
    expect(fetcher.calls[0]!.url).toBe('https://api.openai.com/v1/images/edits')
    const form = fetcher.calls[0]!.init.body as FormData
    expect(form.get('prompt')).toBe(prompt)
    const images = form.getAll('image[]') as File[]
    expect(images.map((file) => file.name)).toEqual(['sample.png', 'logo.png'])
    expect(Buffer.from(await images[0]!.arrayBuffer()).equals(sample)).toBe(true)
    expect(Buffer.from(await images[1]!.arrayBuffer()).equals(logo)).toBe(true)
    expect(result.bytes.equals(edited)).toBe(true)
  })

  it('keeps the sample, with a notice, when image edit fails', async () => {
    const sample = Buffer.concat([TINY_PNG, Buffer.from('sample')])
    const fetcher = mockFetch(() => Response.json({ error: { message: 'billing hard limit' } }, { status: 429 }))
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt: 'x',
      apiKey: 'sk-test-key',
      reference: { bytes: sample, mimeType: 'image/png' },
      brand: { name: 'CodFex' },
    })
    expect(fetcher.calls.every((call) => call.url.endsWith('/images/edits'))).toBe(true)
    expect(result.bytes.equals(sample)).toBe(true)
    expect(result.notice).toMatch(/billing hard limit/)
    expect(result.notice).toMatch(/sample photo/)
  })

  it('with no key and a sample shows the sample without calling OpenAI', async () => {
    const sample = Buffer.concat([TINY_PNG, Buffer.from('sample')])
    const fetcher = mockFetch(() => pngOk())
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt: 'x',
      reference: { bytes: sample, mimeType: 'image/png' },
      brand: { name: 'CodFex' },
    })
    expect(fetcher.calls).toHaveLength(0)
    expect(result.bytes.equals(sample)).toBe(true)
  })
})

describe('Create pipeline with a saved OpenAI key', () => {
  it('passes the admin key, brand kit, services, instructions and the sample to image generation', async () => {
    const { app, deps, media } = testApp()
    deps.httpFetch = async () => new Response(TINY_PNG, { status: 200, headers: { 'content-type': 'image/png' } })
    const staff = await staffLogin(app)
    expect((await staff.api.put('/api/admin/provider-secrets', { openaiKey: 'sk-admin-saved' })).status).toBe(200)

    const owner = await register(app, 'CodFex Studio')
    expect((await owner.api.put('/api/brand', {
      brandName: 'CodFex',
      businessDescription: 'Web programming and graphic design agency',
      productsAndServices: 'Web Programming, Graphic Design, Responsive Websites',
      voiceAndTone: 'Confident',
    })).status).toBe(200)
    expect((await owner.api.put('/api/brand-kit', { primaryColor: '#2F6BFF' })).status).toBe(200)
    const sample = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/sample.png' })
    expect(sample.status).toBe(201)

    const post = await createPost(owner, {
      description: 'CodFex Web Development and graphic design',
      aiInstructions: 'Show a team at their desks, dark navy look',
    })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: sample.body.asset.id })
    expect(generated.status).toBe(202)

    expect(media.imageCalls).toBe(1)
    const request = media.lastRequest!
    expect(request.apiKey).toBe('sk-admin-saved')
    expect(request.reference?.bytes.equals(TINY_PNG)).toBe(true)
    expect(request.brand?.name).toBe('CodFex')
    expect(request.brand?.services).toEqual(['Web Programming', 'Graphic Design', 'Responsive Websites'])
    expect(request.prompt).toMatch(/REQUIRED POSTER LAYOUT/)
    expect(request.prompt).toContain('#2f6bff')
    expect(request.prompt).toContain('Show a team at their desks, dark navy look')
    expect(request.prompt).toContain('Web Programming, Graphic Design, Responsive Websites')
    expect(request.prompt).toMatch(/Attached image 1 is the brand sample/)
  })

  it('does not call the provider when no key is saved and a sample exists', async () => {
    const { app, deps, media } = testApp()
    deps.httpFetch = async () => new Response(TINY_PNG, { status: 200, headers: { 'content-type': 'image/png' } })
    const owner = await register(app, 'No Key Co')
    const sample = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/sample.png' })
    const post = await createPost(owner, { description: 'Sample only' })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: sample.body.asset.id })
    expect(generated.status).toBe(202)
    expect(media.imageCalls).toBe(0)
    expect(generated.body.post.media[0].id).toBe(sample.body.asset.id)
  })
})

describe('no-key local brand poster', () => {
  it('draws a navy plate with no flat brand-colored boxes or bars', () => {
    const img = decodePng(buildLocalMarketingPng({ brandName: 'CodFex', color: BRAND_GREEN, size: 540 }))
    expect(img.width).toBe(540)
    const dark = (rgb: [number, number, number]) => lum(rgb) < 80
    // The old wireframe had a solid brand-colored top bar and left column.
    expect(region(img, 0, 0, 1, 0.07, dark)).toBeGreaterThan(0.95)
    expect(region(img, 0, 0.1, 0.04, 0.8, dark)).toBeGreaterThan(0.95)
    // And a framed panel of green/blue blocks across the middle.
    expect(region(img, 0.1, 0.5, 0.9, 0.78, dark)).toBeGreaterThan(0.9)
    const [r, g, b] = pixel(img, 0.5, 0.02)
    expect(b).toBeGreaterThan(r)
    expect(g).toBeLessThan(80)
  })

  it.skipIf(!hasFfmpeg)('renders a headline, large wordmark, three service chips and a CTA bar', async () => {
    const png = await renderLocalMarketingPoster({
      brandName: 'CodFex',
      headline: 'CodFex Web Development and graphic design',
      tagline: 'Web programming and graphic design agency',
      services: ['Web Programming', 'Graphic Design', 'Responsive Websites'],
      cta: 'Get Started',
      color: BRAND_GREEN,
      size: 1080,
    })
    expect(isDisplayableImage(png, 'image/png')).toBe(true)
    const img = decodePng(png)
    expect([img.width, img.height]).toEqual([1080, 1080])

    const bright = (rgb: [number, number, number]) => lum(rgb) > 200
    // Headline text sits inside the safe margins and is not clipped by the edges.
    expect(region(img, 0.1, 0.4, 0.9, 0.55, bright)).toBeGreaterThan(0.04)
    expect(region(img, 0, 0.4, 0.06, 0.55, bright)).toBe(0)
    expect(region(img, 0.94, 0.4, 1, 0.55, bright)).toBe(0)
    // Wordmark / emblem area at the top.
    expect(region(img, 0.3, 0.05, 0.7, 0.35, bright)).toBeGreaterThan(0.02)
    // CTA bar is a brand-colored pill, but the rest of the poster stays navy.
    const accent = (rgb: [number, number, number]) => rgb[1] > rgb[2] + 20 && rgb[1] > 110
    expect(region(img, 0.32, 0.88, 0.68, 0.94, accent)).toBeGreaterThan(0.4)
    expect(region(img, 0, 0, 1, 0.07, accent)).toBe(0)
    expect(region(img, 0, 0.1, 0.04, 0.8, accent)).toBe(0)
    expect(region(img, 0.1, 0.62, 0.9, 0.7, accent)).toBeLessThan(0.02)
    // Service chips row has three outlined chips with text.
    expect(region(img, 0.04, 0.74, 0.96, 0.82, bright)).toBeGreaterThan(0.02)
  })

  it.skipIf(!hasFfmpeg)('HttpMediaProvider falls back to that poster, and to the sample when one exists', async () => {
    const fetcher = mockFetch(() => pngOk())
    const provider = new HttpMediaProvider(loadEnv(), fetcher.impl)
    const poster = await provider.generateImage({
      prompt: 'p',
      brand: { name: 'CodFex', headline: 'Web Development', color: '#2F6BFF', services: ['Web', 'Design', 'SEO'] },
    })
    expect(fetcher.calls).toHaveLength(0)
    expect(poster.mimeType).toBe('image/png')
    const img = decodePng(poster.bytes)
    expect(img.width).toBeGreaterThanOrEqual(1024)
    expect(poster.bytes.equals(TINY_PNG)).toBe(false)
    expect(poster.notice).toMatch(/No OpenAI key/)
    expect(region(img, 0, 0, 1, 0.07, (rgb) => lum(rgb) < 80)).toBeGreaterThan(0.95)
  })
})
