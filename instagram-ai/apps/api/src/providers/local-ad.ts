import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { renderLocalMarketingPoster, type LocalPosterInput } from './poster'

const BOLD = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'

export type LocalAdPlan = {
  format: 'reel' | 'video'
  width: number
  height: number
  duration: number
  hook: string
  benefits: string[]
  cta: string
  captions: string
  panPhoto: boolean
  brandName?: string
  tagline?: string
  services?: string[]
}

export type SceneWindow = { start: number; end: number }

export type LocalAdScenes = {
  hook: SceneWindow
  product: SceneWindow
  benefit: SceneWindow
  cta: SceneWindow
}

export function planLocalAd(input: {
  format: 'reel' | 'video'
  length: number
  description: string
  instructions: string
  callToAction: string | null
  caption: string
  hasReference: boolean
  brandName?: string | null
  tagline?: string | null
  services?: string[]
}): LocalAdPlan {
  const sentences = input.description
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const hook = clip(sentences[0] || input.description.trim() || 'A draft worth approving', 90)
  const benefits = sentences.slice(1, 3).map((line) => clip(line, 90))
  if (benefits.length === 0) {
    const note = input.instructions.split('\n').map((line) => line.trim()).find(Boolean)
    benefits.push(clip(note || 'Take a closer look', 90))
  }
  return {
    format: input.format,
    width: input.format === 'reel' ? 1080 : 1920,
    height: input.format === 'reel' ? 1920 : 1080,
    duration: input.length,
    hook,
    benefits: benefits.slice(0, 2),
    cta: clip(input.callToAction?.trim() || 'Save this for later', 60),
    captions: clip(input.caption.trim() || hook, 140),
    panPhoto: input.hasReference,
    brandName: input.brandName?.trim() || undefined,
    tagline: input.tagline?.trim() ? clip(input.tagline.trim().split(/\r?\n/)[0]!, 110) : undefined,
    services: input.services?.filter(Boolean).slice(0, 3),
  }
}

export function sceneWindows(duration: number): LocalAdScenes {
  const total = Math.max(duration, 0.4)
  const step = total / 4
  return {
    hook: { start: 0, end: step },
    product: { start: step, end: step * 2 },
    benefit: { start: step * 2, end: step * 3 },
    cta: { start: step * 3, end: total },
  }
}

function spokenSentence(value: string): string {
  const clean = value
    .replace(/#\w+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!clean) return ''
  const short = clean.length > 72 ? clean.slice(0, 69).replace(/\s+\S*$/, '').trim() || clean.slice(0, 69) : clean
  return /[.!?]$/.test(short) ? short : `${short}.`
}

export function spokenScript(plan: Pick<LocalAdPlan, 'hook' | 'benefits' | 'cta'>): string {
  const benefit = plan.benefits.map((line) => line.trim()).find(Boolean) ?? ''
  return [plan.hook, benefit, plan.cta]
    .map(spokenSentence)
    .filter(Boolean)
    .slice(0, 3)
    .join('\n')
    .slice(0, 220)
}

export type AdBrand = { color?: string | null; logo?: Buffer | null }

export function ffmpegColor(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.trim().match(/^#?([0-9a-fA-F]{6})$/)
  return match ? `0x${match[1].toLowerCase()}` : null
}

const FPS = 15

export type AdScene = { name: keyof LocalAdScenes; poster: LocalPosterInput }

/** The four designed scenes: hook, services, benefit and closing CTA, in the brand-poster look. */
export function adScenes(plan: LocalAdPlan, reference: Buffer | null, brand: AdBrand): AdScene[] {
  const canvas = plan.format === 'reel' ? 'tall' : 'wide'
  const name = plan.brandName || 'Your brand'
  const common: LocalPosterInput = {
    brandName: name,
    color: brand.color,
    logo: brand.logo,
    services: plan.services,
    cta: plan.cta,
    canvas,
    size: 1080,
    seed: name,
  }
  const benefit = plan.benefits[0] ?? plan.hook
  const second = plan.benefits[1]
  return [
    { name: 'hook', poster: { ...common, variant: 'cover', headline: plan.hook, tagline: plan.tagline } },
    {
      name: 'product',
      poster: { ...common, variant: 'services', headline: clip(second || 'What we offer', 60), hero: plan.panPhoto ? reference : null },
    },
    { name: 'benefit', poster: { ...common, variant: 'benefit', number: 1, headline: clip(benefit, 80), body: plan.tagline } },
    { name: 'cta', poster: { ...common, variant: 'cta', headline: clip(`Ready to work with ${name}?`, 60), body: plan.tagline } },
  ]
}

export async function renderLocalAd(plan: LocalAdPlan, reference: Buffer | null, brand: AdBrand = {}): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'local-ad-'))
  try {
    const output = path.join(dir, 'silent.mp4')
    const scenes = adScenes(plan, reference, brand)
    const stills: string[] = []
    for (const [index, scene] of scenes.entries()) {
      const file = path.join(dir, `scene-${index}.png`)
      await writeFile(file, await renderLocalMarketingPoster(scene.poster))
      stills.push(file)
    }
    const step = Math.max(plan.duration, 0.4) / scenes.length
    const fade = Math.min(0.4, step / 3)
    const panW = Math.round(plan.width * 1.06)
    const panH = Math.round(plan.height * 1.06)
    const args = ['-y']
    const graph: string[] = []
    stills.forEach((file, i) => {
      const length = i < stills.length - 1 ? step + fade : step
      args.push('-loop', '1', '-framerate', String(FPS), '-t', length.toFixed(3), '-i', file)
      const progress = `t/${length.toFixed(3)}`
      const x = i % 2 === 0 ? `(in_w-out_w)*${progress}` : `(in_w-out_w)*(1-${progress})`
      graph.push(`[${i}:v]scale=${panW}:${panH}:flags=bicubic,crop=${plan.width}:${plan.height}:x='${x}':y='(in_h-out_h)/2',setsar=1,fps=${FPS},format=yuv420p[v${i}]`)
    })
    let last = 'v0'
    for (let i = 1; i < stills.length; i += 1) {
      const next = i === stills.length - 1 ? 'vout' : `x${i}`
      graph.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=${(step * i).toFixed(3)}[${next}]`)
      last = next
    }
    await ffmpeg([
      ...args,
      '-filter_complex', graph.join(';'),
      '-map', `[${last}]`,
      '-t', String(plan.duration), '-r', String(FPS), '-an',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      output,
    ])
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function clip(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return `${clean.slice(0, max - 1).trim()}…`
}

export async function compositeBrandOntoClip(
  bytes: Buffer,
  input: { format: 'reel' | 'video'; line: string; logo: Buffer | null; color: string | null },
): Promise<Buffer> {
  const line = input.line.replace(/\s+/g, ' ').trim()
  if (!line) return bytes
  const dir = await mkdtemp(path.join(tmpdir(), 'brand-line-'))
  try {
    const source = path.join(dir, 'in.mp4')
    const output = path.join(dir, 'out.mp4')
    const lineFile = path.join(dir, 'line.txt')
    await writeFile(source, bytes)
    await writeFile(lineFile, line)
    const size = await probeVideo(source)
    if (!size) return bytes
    const accent = ffmpegColor(input.color) ?? '0x312e81'
    const draw = `drawtext=fontfile=${BOLD}:textfile=${lineFile}:fontsize=42:fontcolor=white:x=(w-text_w)/2:y=h-160:box=1:boxcolor=${accent}@0.92:boxborderw=18`
    const keepAudio = ['-map', '0:a?', '-c:a', 'copy']
    if (input.logo?.length) {
      const logoPath = path.join(dir, 'logo.png')
      await writeFile(logoPath, input.logo)
      const logoW = Math.max(72, Math.round(size.width * 0.16))
      await ffmpeg([
        '-y', '-i', source, '-i', logoPath,
        '-filter_complex', `[0:v]${draw}[base];[1:v]scale=${logoW}:-1[lg];[base][lg]overlay=36:36[v]`,
        '-map', '[v]',
        ...keepAudio,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        output,
      ])
    } else {
      await ffmpeg([
        '-y', '-i', source,
        '-vf', draw,
        '-map', '0:v:0',
        ...keepAudio,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        output,
      ])
    }
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function probeVideo(file: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0',
      file,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    const out: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.on('error', () => resolve(null))
    child.on('close', (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }
      const [width, height] = Buffer.concat(out).toString('utf8').trim().split(',').map(Number)
      if (!width || !height) resolve(null)
      else resolve({ width, height })
    })
  })
}

function ffmpeg(args: string[]): Promise<void> {
  return run('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args])
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    const errors: Buffer[] = []
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `${command} failed`))
    })
  })
}
