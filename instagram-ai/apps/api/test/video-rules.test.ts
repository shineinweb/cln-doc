import { spawn } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdtemp, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { prisma } from '../src/db'
import { loadEnv } from '../src/env'
import { HttpMediaProvider, OPENAI_IMAGE_MODELS, TINY_PNG } from '../src/providers/media'
import { compositeBrandOntoClip, planLocalAd, renderLocalAd, sceneWindows, spokenScript } from '../src/providers/local-ad'
import { ensureVoiceover, SPEECH_MODEL, SPEECH_SPEED, SPEECH_URL, SPEECH_VOICE, spokenLines } from '../src/providers/voice'
import { chooseVideoRoute, mapRunwayDuration, oneBrandLine, produceClip, runwayPrompt, runwayRatio } from '../src/providers/video'
import { assertProviderUrl } from '../src/settings'
import { createPost, register, staffLogin, testApp, upgrade } from './helpers'

describe('runway, provider URL, local ads, and secrets', () => {
  it('maps Runway durations and ratios and never posts to OpenAI video', () => {
    expect(mapRunwayDuration('reel', 4)).toBe(4)
    expect(mapRunwayDuration('reel', 8)).toBe(8)
    expect(mapRunwayDuration('reel', 12)).toBe(10)
    expect(mapRunwayDuration('video', 8)).toBe(8)
    expect(mapRunwayDuration('video', 15)).toBe(10)
    expect(mapRunwayDuration('video', 30)).toBe(10)
    expect(runwayRatio('reel')).toBe('720:1280')
    expect(runwayRatio('video')).toBe('1280:720')
    const prompt = runwayPrompt(
      'Web Development and graphic design',
      '**0:00-0:03** — A wireframe snaps into a finished website.\n**On-screen text** — Web Development',
    )
    expect(prompt).toBe('Web Development and graphic design\nA wireframe snaps into a finished website.\nOn-screen text — Web Development')
    expect(prompt).not.toMatch(/\*\*/)
    expect(prompt).not.toMatch(/\d{1,2}:\d{2}/)
    expect(prompt.length).toBeLessThanOrEqual(1000)
    const root = path.resolve('src')
    for (const file of walk(root).filter((item) => item.endsWith('.ts'))) {
      expect(readFileSync(file, 'utf8')).not.toContain('/v1/videos')
    }
  })

  it('calls Runway gen4.5, then a saved provider URL instead, and renders a local ad otherwise', async () => {
    const seen: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      seen.push(url)
      expect(url).not.toContain('/v1/videos')
      if (url.endsWith('/v1/image_to_video') || url.endsWith('/v1/text_to_video')) {
        const body = JSON.parse(String(init?.body)) as {
          model: string
          promptText: string
          ratio: string
          duration: number
          promptImage?: Array<{ position: string; uri: string }>
        }
        const headers = new Headers(init?.headers)
        expect(headers.get('authorization')).toBe('Bearer key_test_runway_value')
        expect(headers.get('x-runway-version')).toBe('2024-11-06')
        expect(body.model).toBe('gen4.5')
        if (url.endsWith('/v1/image_to_video')) {
          expect(body.promptText).toBe('Fresh coffee\nKeep it warm')
          expect(body.ratio).toBe('720:1280')
          expect(body.duration).toBe(10)
          expect(body.promptImage?.[0]?.position).toBe('first')
          expect(body.promptImage?.[0]?.uri.startsWith('data:image/png;base64,')).toBe(true)
        } else {
          expect(body.promptText).toBe('Wide shop\nKeep the type large')
          expect(body.ratio).toBe('1280:720')
          expect(body.duration).toBe(10)
          expect(body.promptImage).toBeUndefined()
        }
        return json({ id: 'task_1' })
      }
      if (url.endsWith('/v1/tasks/task_1')) return json({ status: 'SUCCEEDED', output: ['https://cdn.example/clip.mp4'] })
      if (url === 'https://cdn.example/clip.mp4') {
        return new Response(Buffer.from('runway-clip'), { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      if (url === 'https://video.example/render') {
        const body = JSON.parse(String(init?.body)) as { script: string; format: string; length: number }
        expect(init?.method).toBe('POST')
        expect(body).toMatchObject({ format: 'video', length: 30 })
        expect(body.script).toContain('Wide shop')
        expect(body.script).toContain('Keep the type large')
        return new Response(Buffer.from('provider-clip'), { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      throw new Error(`unexpected ${url}`)
    }
    const reel = await produceClip({
      format: 'reel',
      length: 12,
      description: 'Fresh coffee',
      instructions: 'Keep it warm',
      callToAction: 'Visit',
      caption: 'Fresh coffee',
      reference: { bytes: TINY_PNG, mimeType: 'image/png' },
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
    }, fetchImpl)
    expect(reel.route).toBe('runway')
    expect(seen.some((url) => url.includes('api.dev.runwayml.com'))).toBe(true)
    seen.length = 0
    const wide = await produceClip({
      format: 'video',
      length: 15,
      description: 'Wide shop',
      instructions: 'Keep the type large',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
    }, fetchImpl)
    expect(wide.route).toBe('runway')
    expect(seen.some((url) => url.endsWith('/v1/text_to_video'))).toBe(true)
    seen.length = 0
    const provided = await produceClip({
      format: 'video',
      length: 30,
      description: 'Wide shop',
      instructions: 'Keep the type large',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: 'https://video.example/render',
    }, fetchImpl)
    expect(provided.route).toBe('provider')
    expect(seen).toEqual(['https://video.example/render'])
    expect(provided.bytes.toString()).toBe('provider-clip')
  })

  it('posts the gen4.5 text_to_video fields and reports the validation error Runway returns', async () => {
    let sent: Record<string, unknown> | undefined
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      expect(url).not.toContain('api.openai.com')
      if (url.endsWith('/v1/text_to_video')) {
        sent = JSON.parse(String(init?.body)) as Record<string, unknown>
        return json({
          error: 'Validation of body failed',
          issues: [{ message: 'promptText must describe the scene' }],
        }, 400)
      }
      throw new Error(`unexpected ${url}`)
    }
    const clip = await produceClip({
      format: 'video',
      length: 8,
      description: 'Web Development and graphic design',
      instructions: '**0:00-0:03** — A wireframe snaps into a finished website.',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
      brandLine: 'CF',
      logo: TINY_PNG,
    }, fetchImpl, async (bytes) => bytes)
    expect(sent).toEqual({
      model: 'gen4.5',
      promptText: 'Web Development and graphic design\nA wireframe snaps into a finished website.',
      ratio: '1280:720',
      duration: 8,
    })
    expect(String(sent?.promptText)).not.toMatch(/\d{1,2}:\d{2}/)
    expect(clip.route).toBe('local')
    expect(clip.notice).toContain('promptText must describe the scene')
    expect(clip.notice).not.toMatch(/credits/i)
    const credited = await produceClip({
      format: 'video',
      length: 8,
      description: 'Web Development and graphic design',
      instructions: '',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
    }, async () => json({ error: 'You do not have enough credits to run this task.' }, 400), async (bytes) => bytes)
    expect(credited.notice).toContain('You do not have enough credits to run this task.')
  })

  it('composites one brand line and the logo onto a mocked Runway clip', async () => {
    const seen: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      seen.push(url)
      expect(url).not.toContain('api.openai.com')
      if (url.endsWith('/v1/text_to_video')) {
        const body = JSON.parse(String(init?.body)) as { model: string; ratio: string }
        expect(body.model).toBe('gen4.5')
        expect(body.ratio).toBe('1280:720')
        return json({ id: 'task_brand' })
      }
      if (url.endsWith('/v1/tasks/task_brand')) return json({ status: 'SUCCEEDED', output: ['https://cdn.example/brand.mp4'] })
      if (url === 'https://cdn.example/brand.mp4') {
        return new Response(Buffer.from('runway-clip'), { status: 200, headers: { 'content-type': 'video/mp4' } })
      }
      throw new Error(`unexpected ${url}`)
    }
    const compositeCalls: Array<{ line: string; hasLogo: boolean; format: string }> = []
    const clip = await produceClip({
      format: 'video',
      length: 15,
      description: 'A wide shop',
      instructions: 'Keep the type large',
      callToAction: null,
      caption: '',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
      brandLine: 'Skincare\nDo not use the second line',
      logo: TINY_PNG,
      brandColor: '#112233',
    }, fetchImpl, async (bytes, input) => {
      expect(bytes.toString()).toBe('runway-clip')
      compositeCalls.push({ line: input.line, hasLogo: Boolean(input.logo?.length), format: input.format })
      return Buffer.from('composited')
    })
    expect(oneBrandLine('Skincare\nDo not use the second line', 'ignored')).toBe('Skincare')
    expect(compositeCalls).toEqual([{ line: 'Skincare', hasLogo: true, format: 'video' }])
    expect(clip.route).toBe('runway')
    expect(clip.bytes.toString()).toBe('composited')
    expect(seen.some((url) => url.includes('api.dev.runwayml.com'))).toBe(true)
    expect(seen.some((url) => url.includes('api.openai.com'))).toBe(false)
  })

  it('plans a vertical reel and a wide video, and gives silent files a voiceover', async () => {
    const reel = planLocalAd({
      format: 'reel',
      length: 4,
      description: 'Fresh coffee on the counter. It stays hot. The mug is handmade.',
      instructions: '',
      callToAction: 'Visit today',
      caption: 'Fresh coffee, approve before publish',
      hasReference: true,
    })
    expect(reel).toMatchObject({ width: 1080, height: 1920, duration: 4, panPhoto: true, cta: 'Visit today' })
    expect(reel.hook).toContain('Fresh coffee on the counter')
    expect(reel.benefits.length).toBe(2)
    expect(reel.captions).toContain('approve before publish')
    expect(spokenScript(reel)).toBe('Fresh coffee on the counter.\nIt stays hot.\nVisit today.')
    expect(sceneWindows(8)).toEqual({
      hook: { start: 0, end: 2 },
      product: { start: 2, end: 4 },
      benefit: { start: 4, end: 6 },
      cta: { start: 6, end: 8 },
    })
    const wide = planLocalAd({
      format: 'video',
      length: 30,
      description: 'A wide look at the shop.',
      instructions: 'Show the pastry case',
      callToAction: null,
      caption: '',
      hasReference: false,
    })
    expect(wide).toMatchObject({ width: 1920, height: 1080, duration: 30, panPhoto: false })
    expect(wide.benefits).toHaveLength(1)
    const rendered = await renderLocalAd({ ...reel, duration: 2, panPhoto: false }, null)
    const size = await probe(rendered)
    expect(size).toMatchObject({ width: 1080, height: 1920, audio: false })
    expect(rendered.slice(4, 8).toString()).toBe('ftyp')
    expect(rendered.length).toBeGreaterThan(1000)
    const voiced = await ensureVoiceover(rendered, 'Fresh coffee on the counter.')
    expect((await probe(voiced)).audio).toBe(true)
    const again = await ensureVoiceover(voiced, 'A different line that must not replace the audio.')
    expect(again.equals(voiced)).toBe(true)
    const burned = await compositeBrandOntoClip(voiced, { format: 'reel', line: 'Cafe', logo: TINY_PNG, color: '#112233' })
    expect((await probe(burned)).audio).toBe(true)
    const kept = await ensureVoiceover(burned, 'A second voice that must not be added.', {
      apiKey: 'sk-existing-openai',
      fetchImpl: async () => {
        throw new Error('live speech was called')
      },
    })
    expect(kept.equals(burned)).toBe(true)
    const panned = await renderLocalAd({ ...wide, duration: 2, panPhoto: true }, TINY_PNG)
    expect(await probe(panned)).toMatchObject({ width: 1920, height: 1080, audio: false })
    expect(chooseVideoRoute({ providerUrl: null, runwayKey: null })).toBe('local')
    const localTone = await toneMp3()
    const local = await produceClip({
      format: 'video',
      length: 8,
      description: 'Fresh coffee on the counter. It stays hot.',
      instructions: '',
      callToAction: 'Visit today',
      caption: 'Fresh coffee',
      reference: null,
      runwayKey: null,
      providerUrl: null,
      openaiKey: 'sk-existing-openai',
      brandColor: '#112233',
    }, async (input, init) => {
      const url = String(input)
      expect(url).toBe(SPEECH_URL)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body).toMatchObject({ model: SPEECH_MODEL, voice: SPEECH_VOICE, speed: SPEECH_SPEED })
      expect(String(body.instructions ?? '')).toMatch(/conversational/i)
      expect(String(body.instructions ?? '')).toMatch(/pause/i)
      expect(String(body.input ?? '')).not.toMatch(/#/)
      expect(String(body.input ?? '').split('\n').length).toBeLessThanOrEqual(3)
      return bytesResponse(localTone, 'audio/mpeg')
    })
    expect(local.route).toBe('local')
    expect(local.mimeType).toMatch(/^video\//)
    expect(local.bytes.length).toBeGreaterThan(1000)
    expect(local.bytes.slice(4, 8).toString()).toBe('ftyp')
    expect(await probe(local.bytes)).toMatchObject({ width: 1920, height: 1080, audio: true })
  })

  it('asks the speech API for coral and does not talk over a clip that already has audio', async () => {
    const plan = planLocalAd({
      format: 'reel',
      length: 4,
      description: 'Fresh coffee on the counter. It stays hot. The mug is handmade.',
      instructions: 'Do not read this instruction aloud',
      callToAction: 'Visit today',
      caption: 'A long caption that should stay on screen and not be read as one flat line. #coffee #latteart',
      hasReference: false,
    })
    const script = spokenScript(plan)
    expect(script).toBe('Fresh coffee on the counter.\nIt stays hot.\nVisit today.')
    expect(script).not.toContain('handmade')
    expect(script).not.toContain('caption')
    expect(script).not.toContain('instruction')
    expect(script).not.toMatch(/#/)
    expect(spokenLines(`${script}\n#pourover #cafe`)).toBe(script)
    expect(spokenLines(`${script}\n#pourover #cafe`).split('\n')).toHaveLength(3)
    const silent = await renderLocalAd({ ...plan, duration: 1, panPhoto: false }, null)
    expect((await probe(silent)).audio).toBe(false)
    const tone = await toneMp3()
    const calls: Array<{ url: string; body: Record<string, unknown>; auth: string | null }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      calls.push({ url, body, auth: new Headers(init?.headers).get('authorization') })
      expect(url).toBe(SPEECH_URL)
      return bytesResponse(tone, 'audio/mpeg')
    }
    const voiced = await ensureVoiceover(silent, `${script}\n#coffee #latteart`, { apiKey: 'sk-existing-openai', fetchImpl })
    expect(calls).toEqual([{
      url: SPEECH_URL,
      auth: 'Bearer sk-existing-openai',
      body: {
        model: SPEECH_MODEL,
        voice: SPEECH_VOICE,
        input: script,
        response_format: 'mp3',
        speed: SPEECH_SPEED,
        instructions: expect.stringMatching(/conversational.*pause|pause.*conversational/i),
      },
    }])
    expect(SPEECH_VOICE).toBe('coral')
    expect(SPEECH_MODEL).toBe('gpt-4o-mini-tts')
    expect(SPEECH_SPEED).toBeLessThan(1)
    expect(String(calls[0]?.body.input ?? '')).not.toMatch(/#/)
    expect(String(calls[0]?.body.input ?? '').split('\n').length).toBeLessThanOrEqual(3)
    expect((await probe(voiced)).audio).toBe(true)
    const providerCalls: string[] = []
    const provided = await produceClip({
      format: 'reel',
      length: 4,
      description: 'Fresh coffee on the counter. It stays hot. The mug is handmade.',
      instructions: '',
      callToAction: 'Visit today',
      caption: 'A long caption that should stay on screen and not be read as one flat line.',
      reference: null,
      runwayKey: null,
      providerUrl: 'https://video.example/render',
      openaiKey: 'sk-existing-openai',
    }, async (input, init) => {
      const url = String(input)
      providerCalls.push(url)
      if (url === 'https://video.example/render') {
        return bytesResponse(silent, 'video/mp4')
      }
      if (url === SPEECH_URL) {
        const body = JSON.parse(String(init?.body)) as { voice?: string; input?: string; speed?: number }
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-existing-openai')
        expect(body.voice).toBe('coral')
        expect(body.speed).toBe(SPEECH_SPEED)
        expect(body.input).toBe(script)
        expect(String(body.input)).not.toMatch(/#/)
        expect(String(body.input).split('\n').length).toBeLessThanOrEqual(3)
        return bytesResponse(tone, 'audio/mpeg')
      }
      throw new Error(`unexpected ${url}`)
    })
    expect(provided.route).toBe('provider')
    expect(providerCalls).toEqual(['https://video.example/render', SPEECH_URL])
    expect((await probe(provided.bytes)).audio).toBe(true)
    const speechCalls: string[] = []
    const clip = await produceClip({
      format: 'video',
      length: 8,
      description: 'Fresh coffee on the counter. It stays hot.',
      instructions: '',
      callToAction: 'Visit today',
      caption: 'Do not add a second voice.',
      reference: null,
      runwayKey: 'key_test_runway_value',
      providerUrl: null,
      openaiKey: 'sk-existing-openai',
      brandLine: 'Cafe',
      logo: TINY_PNG,
      brandColor: '#112233',
    }, async (input) => {
      const url = String(input)
      if (url === SPEECH_URL) {
        speechCalls.push(url)
        throw new Error('second voice')
      }
      expect(url).not.toContain('api.openai.com')
      if (url.endsWith('/v1/text_to_video')) return json({ id: 'task_audio' })
      if (url.endsWith('/v1/tasks/task_audio')) return json({ status: 'SUCCEEDED', output: ['https://cdn.example/voiced.mp4'] })
      if (url === 'https://cdn.example/voiced.mp4') {
        return bytesResponse(voiced, 'video/mp4')
      }
      throw new Error(`unexpected ${url}`)
    })
    expect(speechCalls).toEqual([])
    expect(clip.route).toBe('runway')
    expect((await probe(clip.bytes)).audio).toBe(true)
  })

  it('stores encrypted secrets, lets Support see only the flags, and rejects a Runway key or OpenAI video URL', async () => {
    const { app } = testApp()
    const superAdmin = await staffLogin(app)
    const created = await superAdmin.api.post('/api/admin/staff', {
      email: 'support-staff@example.com',
      name: 'Support',
      password: 'password123',
      role: 'SUPPORT',
    })
    expect(created.status).toBe(201)
    const support = await staffLogin(app, 'support-staff@example.com', 'password123')
    expect(assertProviderUrl('https://video.example/render')).toBe('https://video.example/render')
    expect(() => assertProviderUrl('key_paste_this_runway_secret')).toThrow(/Runway key/)
    expect(() => assertProviderUrl('https://api.openai.com/v1/videos')).toThrow(/OpenAI video/)
    const saved = await superAdmin.api.put('/api/admin/provider-secrets', {
      openaiKey: 'sk-admin-example',
      runwayKey: 'key_test_runway_value',
      videoProviderUrl: 'https://video.example/render',
    })
    expect(saved.status).toBe(200)
    expect(saved.body).toEqual({
      openaiKeySet: true,
      runwayKeySet: true,
      videoProviderUrlSet: true,
      openaiEnabled: true,
      runwayEnabled: true,
      videoProviderUrlEnabled: true,
      status: {
        openai: 'OpenAI key: set, on',
        runway: 'Runway key: set, on',
        videoProvider: 'Video provider URL: set, on',
      },
    })
    expect(JSON.stringify(saved.body)).not.toContain('sk-admin-example')
    expect(JSON.stringify(saved.body)).not.toContain('key_test_runway_value')
    expect(JSON.stringify(saved.body)).not.toContain('video.example')
    const settings = await superAdmin.api.get('/api/admin/settings')
    expect(JSON.stringify(settings.body)).not.toContain('sk-admin-example')
    expect(JSON.stringify(settings.body)).not.toContain('key_test_runway_value')
    const visible = await support.api.get('/api/admin/provider-status')
    expect(visible.status).toBe(200)
    expect(visible.body).toEqual(saved.body)
    expect((await support.api.put('/api/admin/provider-secrets', { openaiKey: 'nope' })).status).toBe(403)
    expect((await support.api.get('/api/admin/settings')).status).toBe(403)
    const runwayInUrl = await superAdmin.api.put('/api/admin/provider-secrets', { videoProviderUrl: 'key_paste_this_runway_secret' })
    expect(runwayInUrl.status).toBe(400)
    const openaiVideos = await superAdmin.api.put('/api/admin/provider-secrets', { videoProviderUrl: 'https://api.openai.com/v1/videos' })
    expect(openaiVideos.status).toBe(400)
    const cleared = await superAdmin.api.put('/api/admin/provider-secrets', { openaiKey: '', runwayKey: null, videoProviderUrl: '' })
    expect(cleared.body).toMatchObject({ openaiKeySet: false, runwayKeySet: false, videoProviderUrlSet: false })
    expect(cleared.body.status.openai).toBe('OpenAI key: not set, on')
    const row = await prisma.siteSetting.findFirst({ where: { key: { in: ['secret.openai', 'secret.runway', 'secret.videoProviderUrl'] } } })
    expect(row).toBeNull()
  })

  it('blocks Starter from Runway and a provider URL, and uses a reference photo as the preview', async () => {
    const { app, deps, media } = testApp()
    const urls: string[] = []
    deps.videoFetch = async (input) => {
      urls.push(String(input))
      throw new Error('live video was called')
    }
    const staff = await staffLogin(app)
    await staff.api.put('/api/admin/provider-secrets', { runwayKey: 'key_test_runway_value' })
    const starter = await register(app, 'Starter Co')
    const reel = await createPost(starter, { format: 'reel', description: 'Counter reel', durationSeconds: 4 })
    const blocked = await starter.api.post(`/api/posts/${reel.id}/generate`, {})
    expect(blocked.status).toBe(202)
    expect(blocked.body.job.status).toBe('ready')
    expect(blocked.body.job.error).toMatch(/does not include generated video/)
    expect(blocked.body.job.error).toMatch(/local designed ad/)
    expect(blocked.body.job.error).not.toMatch(/credits/i)
    expect(blocked.body.post.media[0].mimeType).toBe('video/mp4')
    expect(blocked.body.post.media[0].filename).toContain('local')
    await staff.api.put('/api/admin/provider-secrets', { runwayKey: null, videoProviderUrl: 'https://video.example/render' })
    const blockedUrl = await starter.api.post(`/api/posts/${reel.id}/generate`, {})
    expect(blockedUrl.status).toBe(202)
    expect(blockedUrl.body.job.error).toMatch(/local designed ad/)
    expect(urls).toEqual([])
    expect(media.videoCalls).toBe(0)
    await staff.api.put('/api/admin/provider-secrets', { videoProviderUrl: null })
    const owner = await register(app, 'Photo Co')
    const post = await createPost(owner, { description: 'Use the reference photo' })
    const uploaded = await owner.agent
      .post('/api/media/reference')
      .set('x-csrf-token', owner.csrf)
      .set('x-organization-id', owner.orgId)
      .attach('file', TINY_PNG, { filename: 'cup.png', contentType: 'image/png' })
    expect(uploaded.status).toBe(201)
    await prisma.aiUsage.createMany({
      data: Array.from({ length: 5 }, () => ({ organizationId: owner.orgId, kind: 'image', tokens: 0 })),
    })
    const generated = await owner.api.post(`/api/posts/${post.id}/generate`, { referenceAssetId: uploaded.body.asset.id })
    expect(generated.status).toBe(202)
    expect(media.imageCalls).toBe(0)
    expect(generated.body.post.media[0].filename).toBe('cup.png')
    const instructions = 'a'.repeat(8000)
    const drafted = await owner.api.post('/api/posts', {
      format: 'video',
      description: 'A wide draft',
      durationSeconds: 15,
      aiInstructions: instructions,
      aiLanguage: 'b'.repeat(500),
      aiTone: 'c'.repeat(500),
      generateCaption: false,
    })
    expect(drafted.status).toBe(201)
    expect(drafted.body.post.aiInstructions).toHaveLength(8000)
    expect(drafted.body.post.durationSeconds).toBe(15)
    expect((await owner.api.post('/api/posts', { aiInstructions: 'a'.repeat(8001) })).status).toBe(400)
    const pro = await register(app, 'Language Co')
    await upgrade(pro, 'pro')
    expect((await pro.api.put('/api/ai/profile', { language: 'd'.repeat(500), tone: 'e'.repeat(500) })).status).toBe(200)
    expect((await pro.api.put('/api/ai/profile', { language: 'd'.repeat(501) })).status).toBe(400)
    const profile = await pro.api.get('/api/ai/profile')
    expect(profile.body.language).toHaveLength(500)
    expect(profile.body.tone).toHaveLength(500)
  })

  it('renders the local designed ad when Runway credits fail, the key is missing, or the video quota is used up', async () => {
    const { app, deps } = testApp()
    const calls: string[] = []
    const tone = await toneMp3()
    const speechBodies: Array<Record<string, unknown>> = []
    deps.videoFetch = async (input, init) => {
      const url = String(input)
      calls.push(url)
      if (url === SPEECH_URL) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        speechBodies.push(body)
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer sk-existing-openai')
        return bytesResponse(tone, 'audio/mpeg')
      }
      expect(url).not.toContain('api.openai.com/v1/audio/speech')
      return json({ error: 'You do not have enough credits to run this task. key_live_should_not_leak' }, 402)
    }
    const staff = await staffLogin(app)
    const owner = await register(app, 'CF')
    await upgrade(owner, 'pro')
    await prisma.brandProfile.update({ where: { organizationId: owner.orgId }, data: { brandName: 'CF' } })
    const logo = await prisma.mediaAsset.create({
      data: { organizationId: owner.orgId, kind: 'logo', storageKey: 'logo.png', mimeType: 'image/png', filename: 'logo.png' },
    })
    await deps.storage.put(TINY_PNG, 'png')
    await prisma.organization.update({
      where: { id: owner.orgId },
      data: { brandPrimaryColor: '#112233', brandLogoAssetId: logo.id },
    })
    const post = await createPost(owner, {
      format: 'video',
      description: 'Web Development and graphic design',
      durationSeconds: 8,
      generateCaption: false,
    })
    const placeholder = await prisma.mediaAsset.create({
      data: { organizationId: owner.orgId, kind: 'generated_image', storageKey: 'red.png', mimeType: 'image/png', filename: 'photo-1.png' },
    })
    await prisma.postMedia.create({ data: { postId: post.id, mediaAssetId: placeholder.id, position: 0 } })
    const missingKey = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(missingKey.status).toBe(202)
    expect(missingKey.body.job.error).toBe('No Runway key is stored, so this preview is the local designed ad.')
    expect(missingKey.body.post.media.map((item: { filename: string }) => item.filename)).toEqual(['video.local.mp4'])
    expect(calls).toEqual([])
    await staff.api.put('/api/admin/provider-secrets', { openaiKey: 'sk-existing-openai', runwayKey: 'key_live_should_not_leak' })
    const failed = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(failed.status).toBe(202)
    expect(failed.body.job.status).toBe('ready')
    expect(failed.body.job.error).toContain('You do not have enough credits to run this task')
    expect(failed.body.job.error).toContain('local designed ad')
    expect(failed.body.job.error).not.toContain('key_live_should_not_leak')
    expect(failed.body.post.media).toHaveLength(1)
    expect(failed.body.post.media[0].mimeType).toBe('video/mp4')
    expect(failed.body.post.media[0].filename).toBe('video.local.mp4')
    expect(calls.some((url) => url.includes('api.dev.runwayml.com'))).toBe(true)
    expect(calls.filter((url) => url.includes('api.openai.com'))).toEqual([SPEECH_URL])
    expect(speechBodies[0]).toMatchObject({ model: SPEECH_MODEL, voice: 'coral', speed: SPEECH_SPEED })
    expect(speechBodies[0]?.input).toBe('Web Development and graphic design.\nTake a closer look.\nSave this for later.')
    expect(String(speechBodies[0]?.input)).not.toMatch(/#/)
    expect(String(speechBodies[0]?.input).split('\n').length).toBeLessThanOrEqual(3)
    const asset = await prisma.mediaAsset.findFirst({ where: { filename: 'video.local.mp4', organizationId: owner.orgId }, orderBy: { createdAt: 'desc' } })
    const file = await deps.storage.read(asset?.storageKey ?? '')
    expect(file?.bytes.length).toBeGreaterThan(1000)
    const size = await probe(file?.bytes ?? Buffer.alloc(0))
    expect(size).toMatchObject({ width: 1920, height: 1080, audio: true })
    expect(await solidRed(file?.bytes ?? Buffer.alloc(0))).toBe(false)
    const used = await prisma.aiUsage.count({ where: { organizationId: owner.orgId, kind: 'video' } })
    expect(used).toBe(0)
    const beforeQuota = calls.length
    await prisma.aiUsage.createMany({
      data: Array.from({ length: 50 }, () => ({ organizationId: owner.orgId, kind: 'video' as const, tokens: 0 })),
    })
    const quota = await owner.api.post(`/api/posts/${post.id}/generate`, {})
    expect(quota.status).toBe(202)
    expect(quota.body.job.error).toBe('The monthly video quota is used up, so this preview is the local designed ad.')
    expect(quota.body.post.media[0].mimeType).toBe('video/mp4')
    expect(calls.length).toBe(beforeQuota + 1)
    expect(calls.at(-1)).toBe(SPEECH_URL)
  })

  it('tries image models in order without response_format', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      calls.push({ url, body })
      if (body.model === OPENAI_IMAGE_MODELS[0]) {
        return json({ error: { message: 'model missing' } }, 404)
      }
      return json({ data: [{ b64_json: TINY_PNG.toString('base64') }] })
    }
    const provider = new HttpMediaProvider({ ...loadEnv(), MEDIA_PROVIDER_KEY: 'sk-test' }, fetchImpl)
    const image = await provider.generateImage({ prompt: 'a cup' })
    expect(image.bytes.equals(TINY_PNG)).toBe(true)
    expect(calls.map((call) => call.body.model)).toEqual(['gpt-image-2.5-flare', 'gpt-image-1.5'])
    expect(calls.every((call) => !('response_format' in call.body))).toBe(true)
    expect(calls.every((call) => call.url === 'https://api.openai.com/v1/images/generations')).toBe(true)
    await expect(provider.generateVideo()).rejects.toThrow(/video studio/)
  })

  it('uses image edits when a sample reference is provided, else keeps the sample', async () => {
    const calls: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/images/edits')) {
        return json({ data: [{ b64_json: Buffer.from('edited-ok').toString('base64') }] })
      }
      return json({ error: { message: 'unexpected generations' } }, 500)
    }
    const provider = new HttpMediaProvider({ ...loadEnv(), MEDIA_PROVIDER_KEY: 'sk-test' }, fetchImpl)
    const withEdit = await provider.generateImage({
      prompt: 'polish this brand ad',
      reference: { bytes: TINY_PNG, mimeType: 'image/png' },
    })
    expect(withEdit.bytes.toString()).toBe('edited-ok')
    expect(calls.some((url) => url.includes('/images/edits'))).toBe(true)

    const failingEdits: typeof fetch = async (input) => {
      const url = String(input)
      if (url.includes('/images/edits')) return json({ error: { message: 'nope' } }, 400)
      return json({ error: { message: 'nope' } }, 400)
    }
    const keepSample = new HttpMediaProvider({ ...loadEnv(), MEDIA_PROVIDER_KEY: 'sk-test' }, failingEdits)
    const kept = await keepSample.generateImage({
      prompt: 'polish',
      reference: { bytes: TINY_PNG, mimeType: 'image/png' },
    })
    expect(kept.bytes.equals(TINY_PNG)).toBe(true)
  })
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function bytesResponse(bytes: Buffer, mimeType: string): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': mimeType } })
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

async function probe(bytes: Buffer): Promise<{ width: number; height: number; audio: boolean }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'probe-test-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, bytes)
  const video = await capture('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file])
  const audio = await capture('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file])
  const [width, height] = video.stdout.trim().split(',').map(Number)
  return { width, height, audio: audio.stdout.includes('audio') }
}

function toneMp3(): Promise<Buffer> {
  return captureBuffer('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4',
    '-f', 'mp3', 'pipe:1',
  ])
}

function capture(command: string, args: string[]): Promise<{ stdout: string }> {
  return captureBuffer(command, args).then((stdout) => ({ stdout: stdout.toString('utf8') }))
}

function captureBuffer(command: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.on('error', reject)
    child.on('close', () => resolve(Buffer.concat(out)))
  })
}

async function solidRed(bytes: Buffer): Promise<boolean> {
  const dir = await mkdtemp(path.join(tmpdir(), 'frame-'))
  const file = path.join(dir, 'clip.mp4')
  await writeFile(file, bytes)
  const raw = await captureBuffer('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
  if (raw.length < 12) return false
  const points = [0, Math.floor(raw.length / 2) - (Math.floor(raw.length / 2) % 3), raw.length - 3]
  return points.every((index) => raw[index] > 200 && raw[index + 1] < 40 && raw[index + 2] < 40)
}
