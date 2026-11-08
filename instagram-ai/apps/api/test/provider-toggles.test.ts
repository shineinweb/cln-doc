import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { loadEnv } from '../src/env'
import { HttpMediaProvider, TINY_PNG } from '../src/providers/media'
import { FakeMediaProvider } from '../src/providers/media'
import { OpenAiTextProvider, deterministicCopy, type TextRequest } from '../src/providers/text'
import { chooseVideoRoute, produceClip, videoOffNotice } from '../src/providers/video'
import { SPEECH_URL } from '../src/providers/voice'
import { readProviderEnabled } from '../src/settings'
import { createPost, register, staffLogin, testApp, upgrade } from './helpers'

const SECRETS = {
  openaiKey: 'sk-admin-toggle',
  runwayKey: 'key_test_runway_toggle',
  videoProviderUrl: 'https://video.example/render',
}

describe('provider on/off switches', () => {
  it('defaults every provider to on, keeps the stored secrets when switched off, and logs each toggle', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    expect((await readProviderEnabled(prisma))).toEqual({ openai: true, runway: true, videoProvider: true })
    const fresh = await staff.api.get('/api/admin/provider-status')
    expect(fresh.body).toMatchObject({
      openaiEnabled: true,
      runwayEnabled: true,
      videoProviderUrlEnabled: true,
      status: { openai: 'OpenAI key: not set, on' },
    })

    const saved = await staff.api.put('/api/admin/provider-secrets', SECRETS)
    expect(saved.body.status).toEqual({
      openai: 'OpenAI key: set, on',
      runway: 'Runway key: set, on',
      videoProvider: 'Video provider URL: set, on',
    })

    const off = await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false, videoProviderUrlEnabled: false })
    expect(off.status).toBe(200)
    expect(off.body).toMatchObject({
      openaiKeySet: true,
      runwayKeySet: true,
      videoProviderUrlSet: true,
      openaiEnabled: false,
      runwayEnabled: true,
      videoProviderUrlEnabled: false,
    })
    expect(off.body.status).toEqual({
      openai: 'OpenAI key: set, off',
      runway: 'Runway key: set, on',
      videoProvider: 'Video provider URL: set, off',
    })
    expect(JSON.stringify(off.body)).not.toContain(SECRETS.openaiKey)
    expect(JSON.stringify(off.body)).not.toContain('video.example')

    const reread = await staff.api.get('/api/admin/provider-status')
    expect(reread.body).toEqual(off.body)
    expect(await readProviderEnabled(prisma)).toEqual({ openai: false, runway: true, videoProvider: false })
    expect(await prisma.siteSetting.count({ where: { key: { in: ['secret.openai', 'secret.runway', 'secret.videoProviderUrl'] } } })).toBe(3)

    const toggles = await prisma.auditLog.findMany({ where: { action: 'settings.provider_toggle' }, orderBy: { createdAt: 'asc' } })
    expect(toggles.map((row) => [row.targetId, (row.metadata as { enabled: boolean }).enabled]).sort()).toEqual([
      ['openai', false],
      ['videoProvider', false],
    ])

    const again = await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false })
    expect(again.status).toBe(200)
    expect(await prisma.auditLog.count({ where: { action: 'settings.provider_toggle' } })).toBe(2)

    const on = await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: true })
    expect(on.body.status.openai).toBe('OpenAI key: set, on')
    expect(await prisma.auditLog.count({ where: { action: 'settings.provider_toggle' } })).toBe(3)

    const cleared = await staff.api.put('/api/admin/provider-secrets', { runwayKey: null })
    expect(cleared.body.status.runway).toBe('Runway key: not set, on')
  })

  it('validates the flags and lets only a Super Admin switch a provider', async () => {
    const { app } = testApp()
    const staff = await staffLogin(app)
    expect((await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: 'no' })).status).toBe(400)
    expect((await staff.api.put('/api/admin/provider-secrets', { runwayEnabled: null })).status).toBe(400)
    expect(await readProviderEnabled(prisma)).toEqual({ openai: true, runway: true, videoProvider: true })
    await staff.api.post('/api/admin/staff', { email: 'support-toggle@example.com', name: 'Support', password: 'password123', role: 'SUPPORT' })
    const support = await staffLogin(app, 'support-toggle@example.com', 'password123')
    expect((await support.api.put('/api/admin/provider-secrets', { openaiEnabled: false })).status).toBe(403)
    expect(await readProviderEnabled(prisma)).toEqual({ openai: true, runway: true, videoProvider: true })
    expect((await support.api.get('/api/admin/provider-status')).body.status.openai).toBe('OpenAI key: not set, on')
  })

  it('skips a disabled Runway key and a disabled provider URL when choosing a route', () => {
    const all = { providerUrl: SECRETS.videoProviderUrl, runwayKey: SECRETS.runwayKey }
    expect(chooseVideoRoute(all)).toBe('provider')
    expect(chooseVideoRoute({ ...all, providerEnabled: false })).toBe('runway')
    expect(chooseVideoRoute({ ...all, runwayEnabled: false })).toBe('provider')
    expect(chooseVideoRoute({ ...all, providerEnabled: false, runwayEnabled: false })).toBe('local')
    expect(chooseVideoRoute({ providerUrl: null, runwayKey: null, providerEnabled: false })).toBe('local')
    expect(videoOffNotice({ ...all, runwayEnabled: false })).toBe('Runway is turned off by the admin')
    expect(videoOffNotice({ ...all, providerEnabled: false })).toBe('The video provider is turned off by the admin')
    expect(videoOffNotice({ ...all, providerEnabled: false, runwayEnabled: false })).toBe('Runway and the video provider are turned off by the admin')
    expect(videoOffNotice(all)).toBeNull()
    expect(videoOffNotice({ providerUrl: null, runwayKey: null, runwayEnabled: false })).toBeNull()
  })

  it('does not call Runway, the video provider, or OpenAI speech for a clip when each is switched off', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input))
      throw new Error('a switched-off provider was called')
    }
    const base = {
      format: 'reel' as const,
      length: 4,
      description: 'Fresh coffee on the counter.',
      instructions: '',
      callToAction: 'Visit today',
      caption: 'Fresh coffee.',
      reference: null,
      runwayKey: SECRETS.runwayKey,
      providerUrl: SECRETS.videoProviderUrl,
      openaiKey: SECRETS.openaiKey,
      runwayEnabled: false,
      providerEnabled: false,
      openaiEnabled: false,
    }
    const clip = await produceClip(base, fetchImpl)
    expect(clip.route).toBe('local')
    expect(clip.notice).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('skips only the disabled one of Runway and the provider URL', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input))
      throw new Error('offline')
    }
    const base = {
      format: 'reel' as const,
      length: 4,
      description: 'Fresh coffee on the counter.',
      instructions: '',
      callToAction: null,
      caption: 'Fresh coffee.',
      reference: null,
      runwayKey: SECRETS.runwayKey,
      providerUrl: SECRETS.videoProviderUrl,
      openaiEnabled: false,
    }
    const viaRunway = await produceClip({ ...base, providerEnabled: false }, fetchImpl)
    expect(viaRunway.notice).toMatch(/^Runway could not render/)
    expect(calls.every((url) => url.includes('runwayml.com'))).toBe(true)
    expect(calls.length).toBeGreaterThan(0)
    calls.length = 0
    const viaProvider = await produceClip({ ...base, runwayEnabled: false }, fetchImpl)
    expect(viaProvider.notice).toMatch(/^The video provider could not render/)
    expect(calls).toEqual([SECRETS.videoProviderUrl])
  })

  it('does not ask OpenAI for a voiceover when OpenAI is off', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input))
      throw new Error('speech unavailable')
    }
    const request = {
      format: 'reel' as const,
      length: 4,
      description: 'Fresh coffee on the counter.',
      instructions: '',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: null,
      providerUrl: null,
      openaiKey: SECRETS.openaiKey,
    }
    const on = await produceClip(request, fetchImpl)
    expect(on.route).toBe('local')
    expect(calls.length).toBeGreaterThan(0)
    expect(new Set(calls)).toEqual(new Set([SPEECH_URL]))
    calls.length = 0
    const off = await produceClip({ ...request, openaiEnabled: false }, fetchImpl)
    expect(off.route).toBe('local')
    expect(calls).toEqual([])
  })

  it('draws the local poster without calling OpenAI, and says it is switched off', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      calls.push(String(input))
      throw new Error('OpenAI was called')
    }
    const provider = new HttpMediaProvider({ ...loadEnv(), MEDIA_PROVIDER_KEY: 'sk-env-platform' }, fetchImpl)
    const poster = await provider.generateImage({ prompt: 'x', apiKey: SECRETS.openaiKey, openaiOff: true, brand: { name: 'CodFex' } })
    expect(poster.fallback).toBe(true)
    expect(poster.notice).toBe('OpenAI is turned off by the admin, so this is the local brand poster.')
    const sample = Buffer.concat([TINY_PNG, Buffer.from('sample')])
    const kept = await provider.generateImage({ prompt: 'x', openaiOff: true, reference: { bytes: sample, mimeType: 'image/png' } })
    expect(kept.bytes.equals(sample)).toBe(true)
    expect(kept.notice).toBe('OpenAI is turned off by the admin, so the preview is your sample photo.')
    expect(calls).toEqual([])
  })

  it('answers text from the built-in copy when OpenAI is off, but still honours a customer key', async () => {
    const calls: Array<{ url: string; auth: string | null }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') })
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"caption":"from openai"}' } }] }), { status: 200 })
    }
    let enabled = false
    const provider = new OpenAiTextProvider('platform-key', fetchImpl, async () => enabled)
    const request: TextRequest = {
      kind: 'post_copy',
      system: '',
      brand: { brandName: 'CodFex', businessDescription: '', targetAudience: '', voiceAndTone: '', productsAndServices: '', approvedFacts: [], topicsToAvoid: '', preferredLanguage: '' },
      instructions: '',
      approvedKnowledge: [],
      content: { description: 'Fresh coffee on the counter' },
      model: 'platform-default',
    }
    expect(await provider.complete(request)).toEqual(deterministicCopy(request))
    expect(calls).toEqual([])
    await provider.complete({ ...request, apiKey: 'sk-customer' })
    expect(calls).toEqual([{ url: 'https://api.openai.com/v1/chat/completions', auth: 'Bearer sk-customer' }])
    enabled = true
    await provider.complete(request)
    expect(calls[1]?.auth).toBe('Bearer platform-key')
  })

  it('wires the switch into the app: platform text falls back to built-in copy when OpenAI is off', async () => {
    const { app, deps } = testApp()
    const fetchCalls: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
      fetchCalls.push(String(input))
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    }) as typeof fetch
    try {
      const { createTextProvider } = await import('../src/providers/text')
      const { readProviderEnabled: read } = await import('../src/settings')
      const text = createTextProvider({ ...loadEnv(), TEXT_PROVIDER_KEY: 'platform-key' }, async () => (await read(deps.prisma)).openai)
      const staff = await staffLogin(app)
      await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false })
      const request: TextRequest = {
        kind: 'calendar_ideas',
        system: '',
        brand: { brandName: 'B', businessDescription: '', targetAudience: '', voiceAndTone: '', productsAndServices: '', approvedFacts: [], topicsToAvoid: '', preferredLanguage: '' },
        instructions: '',
        approvedKnowledge: [],
        content: { description: 'Idea' },
        model: 'platform-default',
      }
      const off = await text.complete(request)
      expect(off).toEqual(deterministicCopy(request))
      expect(fetchCalls).toEqual([])
      await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: true })
      await text.complete(request)
      expect(fetchCalls).toEqual(['https://api.openai.com/v1/chat/completions'])
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('image jobs ignore the stored OpenAI key while it is off, with a readable notice', async () => {
    const { app, deps } = testApp()
    const media = new FakeMediaProvider()
    deps.media = media
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { openaiKey: SECRETS.openaiKey })
    await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: false })
    const owner = await register(app, 'Off Co')
    const post = await createPost(owner, { description: 'Coffee on the counter' })
    const off = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(off.status).toBe(202)
    expect(media.lastRequest?.apiKey).toBeUndefined()
    expect(media.lastRequest?.openaiOff).toBe(true)

    await staff.api.put('/api/admin/provider-secrets', { openaiEnabled: true })
    await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(media.lastRequest?.apiKey).toBe(SECRETS.openaiKey)
    expect(media.lastRequest?.openaiOff).toBe(false)
  })

  it('video jobs skip a switched-off Runway key and explain why', async () => {
    const { app, deps } = testApp()
    const calls: string[] = []
    deps.videoFetch = async (input) => {
      calls.push(String(input))
      throw new Error('a switched-off provider was called')
    }
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { runwayKey: SECRETS.runwayKey, openaiKey: SECRETS.openaiKey })
    await staff.api.put('/api/admin/provider-secrets', { runwayEnabled: false, openaiEnabled: false })
    const owner = await register(app, 'Reel Off Co')
    await upgrade(owner, 'pro')
    const post = await createPost(owner, { format: 'reel', description: 'Counter reel', durationSeconds: 4 })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(generated.status).toBe(202)
    expect(generated.body.job.status).toBe('ready')
    expect(generated.body.job.error).toContain('Runway is turned off by the admin, so this preview is the local designed ad.')
    expect(generated.body.job.error).toContain('OpenAI is turned off by the admin, so the voiceover uses the built-in voice.')
    expect(generated.body.post.media[0].filename).toContain('local')
    expect(calls).toEqual([])
  })
})
