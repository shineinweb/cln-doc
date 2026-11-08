import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadEnv } from '../src/env'
import { planCarousel } from '../src/providers/carousel'
import { adScenes, planLocalAd, renderLocalAd } from '../src/providers/local-ad'
import {
  HttpMediaProvider,
  TINY_PNG,
  carouselSlidePrompt,
  isDisplayableImage,
  marketingImagePrompt,
} from '../src/providers/media'
import { computePosterLayout, renderLocalMarketingPoster } from '../src/providers/poster'
import { ensureVoiceover } from '../src/providers/voice'
import { readableFailure } from '../src/services/content'
import { createPost, register, testApp, upgrade } from './helpers'

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

function ffmpegBytes(args: string[], input?: Buffer): Buffer {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 64 * 1024 * 1024, input })
  if (result.status !== 0) throw new Error(`ffmpeg failed ${result.stderr.toString()}`)
  return result.stdout
}

function solidPng(color: string, width: number, height: number): Buffer {
  return ffmpegBytes(['-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}`, '-frames:v', '1', '-f', 'image2pipe', '-c:v', 'png', 'pipe:1'])
}

function dims(png: Buffer): { width: number; height: number } {
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }
}

function rgbAt(png: Buffer, x: number, y: number): [number, number, number] {
  const raw = ffmpegBytes(['-i', 'pipe:0', '-vf', `crop=1:1:${x}:${y}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], png)
  return [raw[0]!, raw[1]!, raw[2]!]
}

function decodeRgb(png: Buffer): { width: number; height: number; data: Buffer } {
  const { width, height } = dims(png)
  const idat: Buffer[] = []
  for (let offset = 8; offset + 8 <= png.length;) {
    const len = png.readUInt32BE(offset)
    if (png.subarray(offset + 4, offset + 8).toString('ascii') === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + len))
    offset += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 3
  const data = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[y * (stride + 1) + 1 + x]!
      const left = x >= 3 ? data[y * stride + x - 3]! : 0
      const up = y > 0 ? data[(y - 1) * stride + x]! : 0
      const upLeft = y > 0 && x >= 3 ? data[(y - 1) * stride + x - 3]! : 0
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
      data[y * stride + x] = value & 255
    }
  }
  return { width, height, data }
}

function brightShare(png: Buffer, x0: number, y0: number, x1: number, y1: number): number {
  const img = decodeRgb(png)
  let hit = 0
  let total = 0
  for (let y = Math.floor(y0 * img.height); y < Math.floor(y1 * img.height); y += 2) {
    for (let x = Math.floor(x0 * img.width); x < Math.floor(x1 * img.width); x += 2) {
      const i = (y * img.width + x) * 3
      total += 1
      if (0.2126 * img.data[i]! + 0.7152 * img.data[i + 1]! + 0.0722 * img.data[i + 2]! > 190) hit += 1
    }
  }
  return hit / total
}

function mockFetch(responder: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    calls.push({ url, init })
    return responder(url, init)
  }) as typeof fetch
  return { calls, impl }
}

const parts = {
  brandName: 'CodFex',
  description: 'Why choose CodFex. Fast responsive websites. Brands that stand out.',
  businessDescription: 'Web programming and graphic design agency',
  productsAndServices: 'Web Programming, Graphic Design, Responsive Websites',
  primaryColor: '#2F6BFF',
  callToAction: 'Get Started',
  hasLogo: true,
}

describe('carousel plan', () => {
  it('always plans a cover, 1-4 benefit slides and a closing CTA slide', () => {
    const rich = planCarousel({
      brandName: 'CodFex',
      description: 'Why choose CodFex. Fast responsive websites. Brands that stand out. Support after launch. Clear pricing.',
      tagline: 'Web programming and graphic design agency',
      services: ['Web Programming', 'Graphic Design', 'Responsive Websites'],
    })
    expect(rich).toHaveLength(6)
    expect(rich.map((slide) => slide.role)).toEqual(['cover', 'benefit', 'benefit', 'benefit', 'benefit', 'cta'])
    expect(rich.every((slide) => slide.total === 6)).toBe(true)
    expect(rich.map((slide) => slide.index)).toEqual([0, 1, 2, 3, 4, 5])
    expect(rich[0]!.headline).toBe('Why choose CodFex.')
    expect(rich[5]!.headline).toBe('Ready to work with CodFex?')
    expect(new Set(rich.map((slide) => slide.headline)).size).toBe(rich.length)

    const bare = planCarousel({ brandName: 'CodFex', description: 'Spring sale' })
    expect(bare).toHaveLength(3)
    expect(bare.map((slide) => slide.role)).toEqual(['cover', 'benefit', 'cta'])
    expect(bare[1]!.headline).toBe('Why CodFex')

    const services = planCarousel({ brandName: 'CodFex', description: 'Spring sale', services: ['Web Programming', 'Graphic Design'] })
    expect(services).toHaveLength(4)
    expect(services[1]).toMatchObject({ role: 'benefit', headline: 'Web Programming' })
  })
})

describe('story and slide prompts', () => {
  it('asks for a vertical 9:16 story poster that stays out of the story UI zones', () => {
    const prompt = marketingImagePrompt({ ...parts, aspect: '9:16' })
    expect(prompt).toMatch(/Instagram Story/)
    expect(prompt).toMatch(/9:16/)
    expect(prompt).toMatch(/top 14% and bottom 20%/)
    expect(prompt).toMatch(/REQUIRED POSTER LAYOUT/)
    expect(prompt).not.toMatch(/square 1:1/)
    expect(marketingImagePrompt(parts)).toMatch(/square 1:1 feed image/)
  })

  it('writes a different, exact-text prompt per slide role and points at the attached guides', () => {
    const cover = carouselSlidePrompt({ ...parts, hasReference: true }, { role: 'cover', index: 0, total: 5, headline: 'Why choose CodFex', body: 'Web agency' })
    const benefit = carouselSlidePrompt({ ...parts, hasStyleGuide: true }, { role: 'benefit', index: 2, total: 5, headline: 'Brands that stand out', body: 'Web agency' })
    const cta = carouselSlidePrompt(parts, { role: 'cta', index: 4, total: 5, headline: 'Ready to work with CodFex?' })
    expect(cover).toMatch(/slide 1 of 5/)
    expect(cover).toContain('"Why choose CodFex"')
    expect(cover).toContain('Swipe')
    expect(cover).toMatch(/Attached image 1 is the brand sample/)
    expect(cover).toMatch(/Attached image 2 is the official CodFex logo/)
    expect(benefit).toMatch(/slide 3 of 5/)
    expect(benefit).toMatch(/number 2/)
    expect(benefit).toMatch(/no call-to-action button/)
    expect(benefit).not.toContain('Call to action text')
    expect(benefit).toMatch(/Attached image 2 is the finished first slide/)
    expect(cta).toMatch(/slide 5 of 5/)
    expect(cta).toContain('"Get Started"')
    expect(cta).toMatch(/SERVICES ROW/)
    for (const prompt of [cover, benefit, cta]) {
      expect(prompt).toMatch(/same deep navy gradient/)
      expect(prompt).toMatch(/Do NOT create a cartoon/)
      expect(prompt).toMatch(/dot \d highlighted/)
    }
  })
})

describe('Create pipeline for carousel and story', () => {
  it('generates 3-6 consistent slides with the brand kit, sample and cover as the style guide', async () => {
    const { app, media } = testApp()
    const owner = await register(app, 'CodFex Studio')
    await upgrade(owner, 'pro')
    expect((await owner.api.put('/api/brand', {
      brandName: 'CodFex',
      businessDescription: 'Web programming and graphic design agency',
      productsAndServices: 'Web Programming, Graphic Design, Responsive Websites',
    })).status).toBe(200)
    expect((await owner.api.put('/api/brand-kit', { primaryColor: '#2F6BFF' })).status).toBe(200)
    const post = await createPost(owner, {
      format: 'carousel',
      description: 'Why choose CodFex. Fast responsive websites. Brands that stand out.',
    })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(generated.status, JSON.stringify(generated.body)).toBe(202)
    expect(generated.body.job.status).toBe('ready')

    const slides = media.requests.map((request) => request.slide!)
    expect(slides.length).toBeGreaterThanOrEqual(3)
    expect(slides.length).toBeLessThanOrEqual(6)
    expect(slides[0]!.role).toBe('cover')
    expect(slides.at(-1)!.role).toBe('cta')
    expect(slides.slice(1, -1).every((slide) => slide.role === 'benefit')).toBe(true)
    expect(media.requests.every((request) => request.aspect === '1:1' && request.composed === true)).toBe(true)
    expect(media.requests[0]!.styleGuide).toBeUndefined()
    expect(media.requests.slice(1).every((request) => Boolean(request.styleGuide))).toBe(true)
    expect(media.requests[1]!.prompt).toMatch(/Attached image 1 is the finished first slide/)
    expect(new Set(media.prompts).size).toBe(media.prompts.length)
    expect(media.requests.every((request) => request.brand?.color === '#2f6bff')).toBe(true)
    expect(generated.body.post.media).toHaveLength(slides.length)
    expect(generated.body.post.media.map((item: { filename: string }) => item.filename)).toEqual(
      slides.map((_, index) => `carousel-${index + 1}.png`),
    )
    expect(generated.body.post.callToAction).toBeTruthy()
    expect(media.requests.at(-1)!.brand?.cta).toBeTruthy()
  })

  it('draws the story as a 9:16 poster and carries the sample through as a guide, not the result', async () => {
    const { app, deps, media } = testApp()
    deps.httpFetch = async () => new Response(TINY_PNG, { status: 200, headers: { 'content-type': 'image/png' } })
    const owner = await register(app, 'Story Co')
    const sample = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/sample.png' })
    const post = await createPost(owner, { format: 'story', description: 'Spring launch. Book a free consult today.' })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: sample.body.asset.id })
    expect(generated.status).toBe(202)
    expect(media.imageCalls).toBe(1)
    const request = media.lastRequest!
    expect(request.aspect).toBe('9:16')
    expect(request.composed).toBe(true)
    expect(request.slide).toBeUndefined()
    expect(request.reference?.bytes.equals(TINY_PNG)).toBe(true)
    expect(request.prompt).toMatch(/Instagram Story/)
    expect(request.prompt).toMatch(/Attached image 1 is the brand sample/)
    expect(generated.body.post.media).toHaveLength(1)
    expect(generated.body.post.media[0].id).not.toBe(sample.body.asset.id)
    expect(generated.body.post.media[0].filename).toBe('story-1.png')
  })

  it('reports an unexpected generation failure as a readable sentence', async () => {
    const { app, media } = testApp()
    media.generateImage = async () => {
      throw new Error('socket hang up')
    }
    const owner = await register(app, 'Failing Co')
    const post = await createPost(owner, { description: 'A photo' })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(generated.status).toBe(502)
    expect(generated.body.error?.message ?? generated.body.message).toBe('The image could not be generated: socket hang up')
    expect(readableFailure(new Error('spawn ffmpeg ENOENT'), 'video')).toMatch(/ffmpeg is not installed/)
    expect(readableFailure(new Error(''), 'video')).toBe('The video could not be generated. Try again.')
    expect(readableFailure(new Error('x'.repeat(400)), 'image').length).toBeLessThan(220)
  })
})

describe('OpenAI path for story and slides', () => {
  const env = loadEnv()

  it.skipIf(!hasFfmpeg)('asks for a portrait image, then crops it to exactly 9:16', async () => {
    const portrait = solidPng('0x123456', 300, 450)
    const fetcher = mockFetch(() => Response.json({ data: [{ b64_json: portrait.toString('base64') }] }))
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt: marketingImagePrompt({ ...parts, aspect: '9:16' }),
      apiKey: 'sk-test',
      aspect: '9:16',
      composed: true,
      brand: { name: 'CodFex' },
    })
    const body = JSON.parse(String(fetcher.calls[0]!.init.body)) as { size: string }
    expect(fetcher.calls[0]!.url).toBe('https://api.openai.com/v1/images/generations')
    expect(body.size).toBe('1024x1536')
    const size = dims(result.bytes)
    expect(size).toEqual({ width: 252, height: 450 })
    expect(result.fallback).toBeUndefined()
  })

  it('attaches the sample, logo and first slide as guide images for a slide', async () => {
    const sample = Buffer.concat([TINY_PNG, Buffer.from('sample')])
    const logo = Buffer.concat([TINY_PNG, Buffer.from('logo')])
    const cover = Buffer.concat([TINY_PNG, Buffer.from('cover')])
    const fetcher = mockFetch(() => Response.json({ data: [{ b64_json: TINY_PNG.toString('base64') }] }))
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt: 'slide',
      apiKey: 'sk-test',
      aspect: '1:1',
      composed: true,
      slide: { role: 'benefit', index: 2, total: 4, headline: 'Brands that stand out' },
      reference: { bytes: sample, mimeType: 'image/png' },
      styleGuide: { bytes: cover, mimeType: 'image/png' },
      brand: { name: 'CodFex', logo },
    })
    expect(fetcher.calls).toHaveLength(1)
    expect(fetcher.calls[0]!.url).toBe('https://api.openai.com/v1/images/edits')
    const form = fetcher.calls[0]!.init.body as FormData
    expect(form.get('size')).toBe('1024x1024')
    expect((form.getAll('image[]') as File[]).map((file) => file.name)).toEqual(['sample.png', 'logo.png', 'style.png'])
    expect(result.bytes.equals(TINY_PNG)).toBe(true)
  })

  it.skipIf(!hasFfmpeg)('draws the local slide, marked as a fallback, when OpenAI fails', async () => {
    const fetcher = mockFetch(() => Response.json({ error: { message: 'billing hard limit' } }, { status: 429 }))
    const provider = new HttpMediaProvider(env, fetcher.impl)
    const result = await provider.generateImage({
      prompt: 'slide',
      apiKey: 'sk-test',
      aspect: '1:1',
      composed: true,
      slide: { role: 'benefit', index: 1, total: 3, headline: 'Web Programming', body: 'Fast websites' },
      brand: { name: 'CodFex', color: '#2F6BFF', services: ['Web'] },
    })
    expect(result.fallback).toBe(true)
    expect(result.notice).toMatch(/billing hard limit/)
    expect(result.notice).toMatch(/local brand poster/)
    expect(dims(result.bytes)).toEqual({ width: 1080, height: 1080 })
  })
})

describe('no-key local story and carousel slides', () => {
  it.skipIf(!hasFfmpeg)('composes the sample into a 9:16 story poster instead of passing it through', async () => {
    const sample = solidPng('0xff8800', 400, 300)
    const provider = new HttpMediaProvider(loadEnv(), mockFetch(() => Response.json({}, { status: 500 })).impl)
    const result = await provider.generateImage({
      prompt: 'story',
      aspect: '9:16',
      composed: true,
      reference: { bytes: sample, mimeType: 'image/png' },
      brand: { name: 'CodFex', headline: 'Spring launch', color: '#2F6BFF', services: ['Web', 'Design', 'SEO'], cta: 'Get Started' },
    })
    expect(result.bytes.equals(sample)).toBe(false)
    expect(result.fallback).toBe(true)
    expect(result.notice).toMatch(/No OpenAI key/)
    expect(dims(result.bytes)).toEqual({ width: 1080, height: 1920 })
    const layout = computePosterLayout({ brandName: 'CodFex', headline: 'Spring launch', services: ['Web', 'Design', 'SEO'], cta: 'Get Started', canvas: 'tall', hero: sample })
    const hero = layout.hero!
    const [r, g, b] = rgbAt(result.bytes, Math.round(hero.x + hero.w / 2), Math.round(hero.y + hero.h / 2))
    expect(r).toBeGreaterThan(200)
    expect(b).toBeLessThan(60)
    expect(g).toBeGreaterThan(90)
    expect(hero.y).toBeGreaterThan(230)
    expect(hero.y + hero.h).toBeLessThan(1920 - 250)
  })

  it.skipIf(!hasFfmpeg)('draws cover, benefit and CTA slides with page dots, a swipe pill and the CTA button', async () => {
    const base = { brandName: 'CodFex', color: '#2F6BFF', services: ['Web Programming', 'Graphic Design', 'Responsive Websites'], cta: 'Get Started', size: 1080 }
    const cover = await renderLocalMarketingPoster({ ...base, variant: 'cover', swipe: true, page: { index: 0, total: 5 }, headline: 'Why choose CodFex' })
    const benefit = await renderLocalMarketingPoster({ ...base, variant: 'benefit', number: 2, page: { index: 2, total: 5 }, headline: 'Brands that stand out', body: 'Web programming and graphic design agency' })
    const closing = await renderLocalMarketingPoster({ ...base, variant: 'cta', page: { index: 4, total: 5 }, headline: 'Ready to work with CodFex?' })
    for (const png of [cover, benefit, closing]) {
      expect(isDisplayableImage(png, 'image/png')).toBe(true)
      expect(dims(png)).toEqual({ width: 1080, height: 1080 })
      expect(brightShare(png, 0.05, 0.15, 0.95, 0.85)).toBeGreaterThan(0)
    }
    expect(cover.equals(benefit)).toBe(false)
    expect(benefit.equals(closing)).toBe(false)
    const accent = (rgb: [number, number, number]) => rgb[2] > 200 && rgb[0] < 120
    const coverLayout = computePosterLayout({ ...base, variant: 'cover', swipe: true, page: { index: 0, total: 5 }, headline: 'Why choose CodFex' })
    expect(coverLayout.cta?.label).toMatch(/Swipe/)
    expect(coverLayout.pills).toHaveLength(0)
    expect(coverLayout.dots).toMatchObject({ count: 5, active: 0 })
    const closingLayout = computePosterLayout({ ...base, variant: 'cta', page: { index: 4, total: 5 }, headline: 'Ready to work with CodFex?' })
    expect(closingLayout.cta?.label).toBe('Get Started')
    expect(closingLayout.pills).toHaveLength(3)
    const cta = closingLayout.cta!
    expect(accent(rgbAt(closing, Math.round(cta.cx - cta.w / 2 + 40), Math.round(cta.y + cta.h / 2)))).toBe(true)
    const benefitLayout = computePosterLayout({ ...base, variant: 'benefit', number: 2, headline: 'Brands that stand out' })
    expect(benefitLayout.marks.length).toBeGreaterThanOrEqual(1)
    expect(benefitLayout.cta).toBeNull()
  })

  it('keeps every layout block inside the canvas and out of the story safe zones', () => {
    const long = 'A very long headline about web programming and graphic design for growing companies everywhere'
    const cases = [
      { canvas: 'tall' as const, variant: 'poster' as const },
      { canvas: 'tall' as const, variant: 'poster' as const, hero: TINY_PNG },
      { canvas: 'tall' as const, variant: 'cover' as const },
      { canvas: 'tall' as const, variant: 'services' as const, hero: TINY_PNG },
      { canvas: 'wide' as const, variant: 'cta' as const },
      { canvas: 'square' as const, variant: 'cover' as const, swipe: true, hero: TINY_PNG },
    ]
    for (const item of cases) {
      const layout = computePosterLayout({ brandName: 'CodFex', headline: long, tagline: long, body: long, services: ['Web Programming', 'Graphic Design', 'Responsive Websites'], cta: 'Get Started', page: { index: 0, total: 4 }, ...item })
      const top = item.canvas === 'tall' ? 220 : 40
      const bottom = layout.H - (item.canvas === 'tall' ? 240 : 40)
      const ys: number[] = []
      if (layout.logo) ys.push(layout.logo.y, layout.logo.y + layout.logo.h)
      if (layout.hero) ys.push(layout.hero.y, layout.hero.y + layout.hero.h)
      for (const pill of layout.pills) ys.push(pill.cy - pill.h / 2, pill.cy + pill.h / 2)
      if (layout.cta) ys.push(layout.cta.y, layout.cta.y + layout.cta.h)
      for (const mark of layout.marks) ys.push(mark.cy - mark.r, mark.cy + mark.r)
      for (const text of layout.texts) ys.push(text.y)
      expect(Math.min(...ys), JSON.stringify(item)).toBeGreaterThanOrEqual(top)
      expect(Math.max(...ys), JSON.stringify(item)).toBeLessThanOrEqual(bottom)
      for (const pill of layout.pills) {
        expect(pill.cx - pill.w / 2).toBeGreaterThanOrEqual(layout.W / 2 - 540)
        expect(pill.cx + pill.w / 2).toBeLessThanOrEqual(layout.W / 2 + 540)
      }
    }
  })
})

describe('local designed ad', () => {
  it('plans four brand-poster scenes in the right canvas, with the sample only as a hero', () => {
    const plan = planLocalAd({
      format: 'reel',
      length: 8,
      description: 'Fresh coffee on the counter. It stays hot. The mug is handmade.',
      instructions: '',
      callToAction: 'Visit today',
      caption: '',
      hasReference: true,
      brandName: 'Cafe Nova',
      tagline: 'Small-batch coffee',
      services: ['Espresso', 'Pour over', 'Cold brew'],
    })
    const scenes = adScenes(plan, TINY_PNG, { color: '#2F6BFF', logo: null })
    expect(scenes.map((scene) => scene.name)).toEqual(['hook', 'product', 'benefit', 'cta'])
    expect(scenes.map((scene) => scene.poster.variant)).toEqual(['cover', 'services', 'benefit', 'cta'])
    expect(scenes.every((scene) => scene.poster.canvas === 'tall' && scene.poster.brandName === 'Cafe Nova')).toBe(true)
    expect(scenes[0]!.poster.headline).toBe('Fresh coffee on the counter.')
    expect(scenes[1]!.poster.hero).toBe(TINY_PNG)
    expect(scenes[1]!.poster.services).toEqual(['Espresso', 'Pour over', 'Cold brew'])
    expect(scenes[3]!.poster.cta).toBe('Visit today')
    const wide = planLocalAd({ ...{ format: 'video' as const, length: 15, description: 'A wide look', instructions: '', callToAction: null, caption: '', hasReference: false } })
    const wideScenes = adScenes(wide, null, {})
    expect(wideScenes.every((scene) => scene.poster.canvas === 'wide')).toBe(true)
    expect(wideScenes[1]!.poster.hero).toBeNull()
  })

  it.skipIf(!hasFfmpeg)('renders the reel as a 9:16 clip of exactly the chosen length with the brand look in each scene', async () => {
    const plan = planLocalAd({
      format: 'reel',
      length: 4,
      description: 'Web Development and graphic design. Fast responsive websites.',
      instructions: '',
      callToAction: 'Get Started',
      caption: '',
      hasReference: false,
      brandName: 'CodFex',
      tagline: 'Web programming and graphic design agency',
      services: ['Web Programming', 'Graphic Design', 'Responsive Websites'],
    })
    const clip = await renderLocalAd(plan, null, { color: '#2F6BFF', logo: null })
    const dir = mkdtempSync(path.join(tmpdir(), 'ad-test-'))
    try {
      const file = path.join(dir, 'ad.mp4')
      writeFileSync(file, clip)
      const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'csv=p=0', file]).stdout.toString().trim().split(',')
      expect(Number(probe[0])).toBe(1080)
      expect(Number(probe[1])).toBe(1920)
      expect(Number(probe[2])).toBeCloseTo(4, 0)
      const frame = (second: number) => {
        const raw = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', String(second), '-i', file, '-frames:v', '1', '-vf', 'scale=270:480', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { maxBuffer: 16 * 1024 * 1024 }).stdout
        return raw
      }
      const stats = (raw: Buffer) => {
        let bright = 0
        let blueish = 0
        let red = 0
        for (let i = 0; i + 2 < raw.length; i += 3) {
          const lum = 0.2126 * raw[i]! + 0.7152 * raw[i + 1]! + 0.0722 * raw[i + 2]!
          if (lum > 200) bright += 1
          if (raw[i + 2]! > raw[i]! + 40) blueish += 1
          if (raw[i]! > raw[i + 2]! + 60) red += 1
        }
        const pixels = raw.length / 3
        return { bright: bright / pixels, blueish: blueish / pixels, red: red / pixels }
      }
      for (const second of [0.5, 1.5, 2.5, 3.5]) {
        const s = stats(frame(second))
        expect(s.bright, `text at ${second}s`).toBeGreaterThan(0.01)
        expect(s.blueish, `navy at ${second}s`).toBeGreaterThan(0.6)
        expect(s.red, `no red at ${second}s`).toBeLessThan(0.02)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it.skipIf(!hasFfmpeg)('fits a long voiceover into a short clip instead of cutting the sentence', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'voice-test-'))
    try {
      const video = ffmpegBytes(['-f', 'lavfi', '-i', 'color=c=0x123456:s=160x160:d=1:r=10', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1'])
      const speech = ffmpegBytes(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.6', '-f', 'mp3', 'pipe:1'])
      const voiced = await ensureVoiceover(video, 'A line that is read aloud.', {
        apiKey: 'sk-test',
        fetchImpl: (async () => new Response(new Uint8Array(speech), { status: 200, headers: { 'content-type': 'audio/mpeg' } })) as typeof fetch,
      })
      const file = path.join(dir, 'voiced.mp4')
      writeFileSync(file, voiced)
      const streams = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'csv=p=0', file]).stdout.toString()
      expect(streams).toMatch(/audio/)
      const audioLength = Number(streams.split('\n').find((line) => line.startsWith('audio'))?.split(',')[1])
      expect(audioLength).toBeLessThan(1.15)
      const volume = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
      expect(volume).toMatch(/max_volume: -\d+(\.\d+)? dB/)
      expect(volume).not.toMatch(/max_volume: -91/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
