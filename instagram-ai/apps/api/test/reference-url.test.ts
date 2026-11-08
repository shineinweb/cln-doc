import { describe, expect, it } from 'vitest'
import {
  buildLocalMarketingPng,
  looksLikeCartoonLandscape,
  marketingImagePrompt,
  TINY_PNG,
} from '../src/providers/media'
import { SAMPLE_IMAGE_MAX_BYTES } from '../src/services/reference-url'
import { createPost, register, testApp } from './helpers'

function pngResponse(bytes = TINY_PNG, contentType = 'image/png') {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': contentType, 'content-length': String(bytes.length) },
  })
}

describe('sample / reference URL', () => {
  it('fetches an https image URL into a reference asset and uses it on generate', async () => {
    const { app, deps, media } = testApp()
    const urls: string[] = []
    deps.httpFetch = async (input) => {
      urls.push(String(input))
      return pngResponse()
    }
    const owner = await register(app, 'Sample URL Co')
    const uploaded = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/product.png' })
    expect(uploaded.status).toBe(201)
    expect(uploaded.body.asset.id).toBeTruthy()
    expect(uploaded.body.asset.url).toContain('/')
    expect(urls).toEqual(['https://cdn.example.com/product.png'])

    await prismaUsageAtImageQuota(owner.orgId)
    const post = await createPost(owner, { description: 'Product on the counter' })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: uploaded.body.asset.id })
    expect(generated.status).toBe(202)
    expect(media.imageCalls).toBe(0)
    expect(generated.body.post.referenceAssetId).toBe(uploaded.body.asset.id)
    expect(generated.body.post.reference?.id).toBe(uploaded.body.asset.id)
    expect(generated.body.post.media[0].filename).toBe('product.png')
    expect(generated.body.post.media[0].id).toBe(uploaded.body.asset.id)
    const sampleBytes = await deps.storage.read(
      (await deps.prisma.mediaAsset.findUniqueOrThrow({ where: { id: uploaded.body.asset.id } })).storageKey,
    )
    expect(sampleBytes?.bytes.equals(TINY_PNG)).toBe(true)
    expect(looksLikeCartoonLandscape(sampleBytes!.bytes)).toBe(false)

    const viaGenerate = await createPost(owner, { description: 'Second product' })
    deps.httpFetch = async () => pngResponse()
    const second = await owner.api.post(`/api/posts/${viaGenerate.id}/generate`, { sampleUrl: 'https://images.example.com/cup.jpg' })
    expect(second.status).toBe(202)
    expect(second.body.post.referenceAssetId).toBeTruthy()
    expect(second.body.post.media[0].mimeType).toBe('image/png')
    expect(media.imageCalls).toBe(0)
  })

  it('passes the sample through as the Photo, uses it as a carousel guide, and never generates a cartoon landscape', async () => {
    const { app, deps, media } = testApp()
    deps.httpFetch = async () => pngResponse()
    const owner = await register(app, 'Pass Through Co')
    const uploaded = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/codfex-ad.png' })
    const post = await createPost(owner, {
      format: 'photo',
      description: 'CodFex Web Development and graphic design',
    })
    const carousel = await createPost(owner, {
      format: 'carousel',
      description: 'CodFex services carousel',
    })
    const photoGen = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: uploaded.body.asset.id })
    const carouselGen = await owner.api.post(`/api/posts/${carousel.id}/generate`, { referenceAssetId: uploaded.body.asset.id })
    expect(photoGen.status).toBe(202)
    expect(carouselGen.status).toBe(202)
    // Photo keeps the sample as-is; the carousel designs its own slides and uses the sample as a guide.
    expect(media.imageCalls).toBe(carouselGen.body.post.media.length)
    expect(carouselGen.body.post.media.length).toBeGreaterThanOrEqual(3)
    expect(carouselGen.body.post.media.every((item: { id: string }) => item.id !== uploaded.body.asset.id)).toBe(true)
    expect(media.requests[0]?.reference?.bytes.equals(TINY_PNG)).toBe(true)
    expect(photoGen.body.post.media[0].id).toBe(uploaded.body.asset.id)
    expect(photoGen.body.post.media.every((item: { id: string; filename: string }) => (
      item.id === uploaded.body.asset.id || item.filename === 'codfex-ad.png'
    ))).toBe(true)
    const asset = await deps.prisma.mediaAsset.findUniqueOrThrow({ where: { id: photoGen.body.post.media[0].id } })
    const file = await deps.storage.read(asset.storageKey)
    expect(file?.bytes.equals(TINY_PNG)).toBe(true)
    expect(looksLikeCartoonLandscape(file!.bytes)).toBe(false)
  })
})

describe('local marketing poster', () => {
  it('builds a dark marketing card instead of a hills cartoon', () => {
    const poster = buildLocalMarketingPng({
      seed: 'codfex',
      brandName: 'CodFex',
      headline: 'Web Programming and Graphic Design',
      color: '#0B1D36',
      size: 128,
    })
    expect(looksLikeCartoonLandscape(poster)).toBe(false)
    expect(poster.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true)
    expect(poster.readUInt32BE(16)).toBe(128)
  })

  it('asks OpenAI for a polished marketing poster, not a landscape', () => {
    const prompt = marketingImagePrompt({
      brandName: 'CodFex',
      description: 'Web programming and graphic design',
      primaryColor: '#0B1D36',
      businessDescription: 'Agency',
    })
    expect(prompt).toMatch(/polished professional marketing poster/i)
    expect(prompt).toMatch(/Do NOT create a cartoon/i)
    expect(prompt).not.toMatch(/rolling hills with a sun/i)
  })
})

describe('sample / reference URL validation', () => {

  it('rejects non-http(s) URLs, HTML pages, non-image responses, and oversized files', async () => {
    const { app, deps } = testApp()
    const owner = await register(app, 'Bad Sample Co')

    const ftp = await owner.api.post('/api/media/reference-url', { url: 'ftp://files.example.com/a.png' })
    expect(ftp.status).toBe(400)
    expect(ftp.body.error.message).toMatch(/http/i)

    const fileUrl = await owner.api.post('/api/media/reference-url', { url: 'file:///etc/passwd' })
    expect(fileUrl.status).toBe(400)

    deps.httpFetch = async () => new Response('<!doctype html><html><body>shop</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })
    const html = await owner.api.post('/api/media/reference-url', { url: 'https://shop.example.com/product' })
    expect(html.status).toBe(400)
    expect(html.body.error.message).toMatch(/not a web page|PNG, JPEG, or WebP/i)

    deps.httpFetch = async () => new Response('not-an-image', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
    const json = await owner.api.post('/api/media/reference-url', { url: 'https://api.example.com/item' })
    expect(json.status).toBe(400)

    deps.httpFetch = async () => new Response(Buffer.alloc(16, 1), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
    const junkPng = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/fake.png' })
    expect(junkPng.status).toBe(400)

    deps.httpFetch = async () => new Response(TINY_PNG, {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': String(SAMPLE_IMAGE_MAX_BYTES + 1) },
    })
    const tooBigHeader = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/huge.png' })
    expect(tooBigHeader.status).toBe(413)

    const oversized = Buffer.alloc(SAMPLE_IMAGE_MAX_BYTES + 1, 0)
    // Valid PNG header so content-type alone is not enough to reject before size check.
    TINY_PNG.copy(oversized, 0)
    deps.httpFetch = async () => new Response(oversized, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
    const tooBigBody = await owner.api.post('/api/media/reference-url', { url: 'https://cdn.example.com/stream.png' })
    expect(tooBigBody.status).toBe(413)

    deps.httpFetch = async () => new Response('<html><title>x</title></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })
    const generateRejected = await owner.api.post(`/api/posts/${(await createPost(owner)).id}/generate`, {
      sampleUrl: 'https://shop.example.com/page',
    })
    expect(generateRejected.status).toBe(400)
  })
})

async function prismaUsageAtImageQuota(organizationId: string) {
  const { prisma } = await import('../src/db')
  await prisma.aiUsage.createMany({
    data: Array.from({ length: 5 }, () => ({ organizationId, kind: 'image', tokens: 0 })),
  })
}
