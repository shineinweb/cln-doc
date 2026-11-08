import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

type AudioState = 'present' | 'silent' | 'unknown'

export const SPEECH_VOICE = 'coral'
export const SPEECH_MODEL = 'gpt-4o-mini-tts'
export const SPEECH_URL = 'https://api.openai.com/v1/audio/speech'
export const SPEECH_SPEED = 0.9

const SPEECH_INSTRUCTIONS =
  'Speak like a friendly person on camera: conversational and slightly slower than usual, with a short natural pause between each sentence. Soft warmth and varied rhythm — never monotone, flat, or robotic. Do not sound like you are reading a caption or hashtags.'

const SPEECH_ATTEMPTS: Array<{ model: string; instructions?: string }> = [
  { model: SPEECH_MODEL, instructions: SPEECH_INSTRUCTIONS },
  { model: 'tts-1-hd' },
  { model: 'tts-1' },
]

export type VoiceoverOptions = {
  apiKey?: string | null
  /** False when the admin turned OpenAI off: skip the OpenAI voice and use the built-in one. */
  enabled?: boolean
  fetchImpl?: typeof fetch
}

export async function ensureVoiceover(bytes: Buffer, script: string, options: VoiceoverOptions = {}): Promise<Buffer> {
  const state = await audioState(bytes)
  if (state !== 'silent') return bytes
  const spoken = spokenLines(script)
  const key = options.enabled === false ? '' : options.apiKey?.trim()
  if (key) {
    let audio: Buffer | null = null
    try {
      audio = await openAiSpeech(spoken, key, options.fetchImpl ?? fetch)
    } catch {
      audio = null
    }
    if (audio) {
      try {
        return await muxVoice(bytes, audio, 'mp3')
      } catch {
        return bytes
      }
    }
  }
  return fliteVoiceover(bytes, spoken)
}

/** Keep 2–3 short spoken lines; never read hashtags or a long caption. */
export function spokenLines(script: string): string {
  const lines = script
    .split(/\n+/)
    .map((line) => line
      .replace(/#\w+/g, ' ')
      .replace(/[^\p{L}\p{N}\s.,!?'-]/gu, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim())
    .filter(Boolean)
    .map((line) => {
      const clipped = line.length > 72 ? `${line.slice(0, 69).replace(/\s+\S*$/, '').trim() || line.slice(0, 69)}` : line
      return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`
    })
    .slice(0, 3)
  return lines.join('\n').slice(0, 220) || 'Take a closer look.'
}

async function openAiSpeech(script: string, apiKey: string, fetchImpl: typeof fetch): Promise<Buffer> {
  let last = 'Speech provider failed'
  for (const attempt of SPEECH_ATTEMPTS) {
    const body: Record<string, string | number> = {
      model: attempt.model,
      voice: SPEECH_VOICE,
      input: script,
      response_format: 'mp3',
      speed: SPEECH_SPEED,
    }
    if (attempt.instructions) body.instructions = attempt.instructions
    try {
      const response = await fetchImpl(SPEECH_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        last = (await response.text().catch(() => last)).replace(/\s+/g, ' ').trim().slice(0, 300) || last
        continue
      }
      const audio = Buffer.from(await response.arrayBuffer())
      if (audio.length) return audio
      last = 'Speech provider returned empty audio'
    } catch (error) {
      last = error instanceof Error ? error.message : last
    }
  }
  throw new Error(last)
}

async function fliteVoiceover(bytes: Buffer, spoken: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'voice-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const text = path.join(dir, 'script.txt')
    const output = path.join(dir, 'out.mp4')
    await writeFile(input, bytes)
    await writeFile(text, spoken)
    const duration = await probeDuration(input)
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', input,
      '-f', 'lavfi', '-i', `flite=textfile=${text}`,
      '-filter_complex', '[1:a]apad[a]',
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
    ]
    if (duration && duration > 0) args.push('-t', String(duration))
    else args.push('-shortest')
    args.push(output)
    await run('ffmpeg', args)
    return await readFile(output)
  } catch {
    return bytes
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function muxVoice(bytes: Buffer, audio: Buffer, extension: string): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'voice-'))
  try {
    const input = path.join(dir, 'in.mp4')
    const speech = path.join(dir, `speech.${extension}`)
    const output = path.join(dir, 'out.mp4')
    await writeFile(input, bytes)
    await writeFile(speech, audio)
    const duration = await probeDuration(input)
    const spoken = await probeDuration(speech)
    const tempo = duration && spoken && spoken > duration ? Math.min(1.6, spoken / duration) : 1
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', input,
      '-i', speech,
      '-filter_complex', tempo > 1.02 ? `[1:a]atempo=${tempo.toFixed(3)},apad[a]` : '[1:a]apad[a]',
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
    ]
    if (duration && duration > 0) args.push('-t', String(duration))
    else args.push('-shortest')
    args.push(output)
    await run('ffmpeg', args)
    return await readFile(output)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function audioState(bytes: Buffer): Promise<AudioState> {
  const dir = await mkdtemp(path.join(tmpdir(), 'probe-'))
  try {
    const file = path.join(dir, 'in.mp4')
    await writeFile(file, bytes)
    const result = await runCapture('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'csv=p=0',
      file,
    ])
    if (result.code !== 0) return 'unknown'
    return result.stdout.includes('audio') ? 'present' : 'silent'
  } catch {
    return 'unknown'
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function probeDuration(file: string): Promise<number | null> {
  const result = await runCapture('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    file,
  ])
  if (result.code !== 0) return null
  const value = Number(result.stdout.trim())
  return Number.isFinite(value) ? value : null
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

function runCapture(command: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8') }))
  })
}
