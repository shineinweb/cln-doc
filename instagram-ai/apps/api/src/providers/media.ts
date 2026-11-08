import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Env } from '../env'
import { OPENAI_OFF_NOTICE } from '../settings'
import {
  buildLocalMarketingPng,
  clip,
  isDisplayableImage,
  renderLocalMarketingPoster,
  runFfmpeg,
  sniffImageMime,
  type PosterCanvas,
  type PosterVariant,
  parseServiceList,
} from './poster'

export {
  TINY_PNG,
  buildFakePreviewPng,
  buildLocalMarketingPng,
  buildLocalScenePng,
  isDisplayableImage,
  looksLikeCartoonLandscape,
  parseServiceList,
  renderLocalMarketingPoster,
  type LocalPosterInput,
} from './poster'

export type MediaBrand = {
  name?: string
  headline?: string
  tagline?: string
  services?: string[]
  cta?: string | null
  color?: string | null
  logo?: Buffer | null
}

export type MediaAspect = '1:1' | '9:16'
export type SlideRole = 'cover' | 'benefit' | 'cta'

export type MediaSlide = { role: SlideRole; index: number; total: number; headline: string; body?: string }

export type MediaResult = {
  bytes: Buffer
  mimeType: string
  notice?: string
  /** True when the local brand poster was drawn instead of an OpenAI image. */
  fallback?: boolean
}

export type MediaRequest = {
  prompt: string
  apiKey?: string
  /** When set, prefer image-to-image edits; otherwise keep these bytes as the result. */
  reference?: { bytes: Buffer; mimeType: string }
  brand?: MediaBrand
  aspect?: MediaAspect
  /** Carousel slide being drawn. */
  slide?: MediaSlide
  /** Finished first slide, attached so the other slides match it. */
  styleGuide?: { bytes: Buffer; mimeType: string }
  /** Story and carousel: the sample is composed into the poster instead of replacing it. */
  composed?: boolean
  /** Skip OpenAI and draw the local brand poster. */
  forceLocal?: boolean
  /** The admin turned OpenAI off: send nothing to OpenAI and say so in the notice. */
  openaiOff?: boolean
}

export interface MediaProvider {
  generateImage(input: MediaRequest): Promise<MediaResult>
  generateVideo(input: MediaRequest): Promise<MediaResult>
}

export const OPENAI_IMAGE_MODELS = ['gpt-image-2.5-flare', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'] as const

export type PromptParts = {
  brandName: string
  description: string
  businessDescription?: string
  productsAndServices?: string
  voiceAndTone?: string
  targetAudience?: string
  primaryColor?: string | null
  category?: string | null
  styleNotes?: string | null
  instructions?: string | null
  tone?: string | null
  language?: string | null
  topicsToAvoid?: string | null
  callToAction?: string | null
  hasReference?: boolean
  hasLogo?: boolean
  /** The first slide, attached so later slides match its look. */
  hasStyleGuide?: boolean
  aspect?: MediaAspect
}

function headlineFrom(parts: PromptParts): string {
  return parts.description.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || parts.brandName
}

function attachmentLines(parts: PromptParts): string[] {
  const out: string[] = []
  let n = 0
  if (parts.hasReference) {
    n += 1
    out.push(`Attached image ${n} is the brand sample photo. Treat it as the primary visual: keep its subjects, composition, colors and brand look, then refine it into a polished finished ad.`)
  }
  if (parts.hasLogo) {
    n += 1
    out.push(`Attached image ${n} is the official ${parts.brandName} logo. Reproduce it exactly (shape, colors, lettering) in the logo zone. Do not redraw, restyle or invent another logo.`)
  }
  if (parts.hasStyleGuide) {
    n += 1
    out.push(`Attached image ${n} is the finished first slide of this carousel. Match its background, glow, typography, logo placement, icon style and page dots exactly so every slide looks like one set. Do not copy its text.`)
  }
  return out
}

function brandLines(parts: PromptParts): string[] {
  return [
    'BRAND',
    `- Name: ${parts.brandName} (spell it exactly "${parts.brandName}" everywhere it appears).`,
    parts.primaryColor ? `- Brand primary color: ${parts.primaryColor}. Use it for the logo mark, highlights, icons, service chips and the CTA button.` : '- Brand color: choose one confident electric blue accent.',
    '- Palette: deep navy gradient atmosphere (about #050C24 to #0A1E4E) with soft glows in the brand color; white headline type.',
    parts.businessDescription ? `- Business: ${parts.businessDescription}` : '',
    parts.productsAndServices ? `- Products and services: ${parts.productsAndServices}` : '',
    parts.targetAudience ? `- Audience: ${parts.targetAudience}` : '',
    parts.voiceAndTone ? `- Voice and tone: ${parts.voiceAndTone}` : '',
  ]
}

function avoidLines(parts: PromptParts): string[] {
  return [
    'AVOID',
    '- Do NOT create a cartoon, children’s illustration, clip-art landscape, rolling hills, sun-and-trees scene, wireframe, or flat boxes.',
    '- No lorem ipsum, gibberish text, extra logos, watermarks, borders, or phone mock-ups.',
    parts.topicsToAvoid ? `- Also avoid: ${parts.topicsToAvoid}.` : '',
    '- Do not invent a real person’s likeness from a name.',
  ]
}

function postLines(parts: PromptParts, withCta = true): string[] {
  return [
    'POST CONTENT',
    `- Description / headline subject: ${parts.description}`,
    parts.category ? `- Category: ${parts.category}. ${parts.styleNotes || ''}`.trim() : '',
    withCta ? (parts.callToAction ? `- Call to action text: "${parts.callToAction}"` : '- Call to action text: "Learn more"') : '',
    parts.instructions ? `- AI instructions from the brand team (follow them): ${parts.instructions}` : '',
    parts.tone ? `- Post tone: ${parts.tone}.` : '',
    parts.language ? `- Text language: ${parts.language}.` : '',
  ]
}

function tidy(lines: string[]): string {
  return lines.filter((line, i, all) => line !== '' || (i > 0 && all[i - 1] !== '')).join('\n')
}

const HERO_SCENE = 'a photorealistic team or office scene that fits the business, for example people collaborating at desks, large monitors and screens showing relevant work, cinematic dark navy lighting with brand-color rim light and shallow depth of field. Real photography feel, no cartoon.'

export function marketingImagePrompt(parts: PromptParts): string {
  const services = parseServiceList(parts.productsAndServices, 4)
  const headline = headlineFrom(parts)
  const story = parts.aspect === '9:16'
  const lines = [
    story
      ? 'Create a polished professional marketing poster / brand advertisement for an Instagram Story: vertical 9:16 frame (compose it for a 1080x1920 story).'
      : 'Create a polished professional marketing poster / brand advertisement for Instagram: square 1:1 feed image, 1024x1024.',
    '',
    ...brandLines(parts),
    '',
    ...postLines(parts),
    '',
    'REQUIRED POSTER LAYOUT, top to bottom',
    `1. LOGO (top${story ? ', below the story safe area' : ', about 18% of the height'}): large ${parts.brandName} logo centered with generous margin${parts.hasLogo ? ' (use the attached logo)' : ' (a clean geometric mark plus the wordmark)'}.`,
    `2. HEADLINE: a short bold white headline derived from "${headline}", centered under the logo, max ${story ? 'three' : 'two'} lines, never clipped or touching the edges.`,
    `3. HERO SCENE (middle, about ${story ? '40' : '45'}% of the height): ${HERO_SCENE}`,
    `4. SERVICES ROW (above the footer): ${services.length ? `${services.length} icon + label items for ${services.join(', ')}` : '3 or 4 icon + label items for the main services'}, each with a simple line icon in the brand color, separated by thin dividers.`,
    `5. CTA FOOTER (bottom): a rounded button or bar in the brand color with the text "${parts.callToAction || 'Learn more'}", with ${parts.brandName} and a one-line tagline in small type beneath.`,
    '',
    'STYLE',
    '- High-end dark navy marketing ad like a modern web, software or design agency campaign: clear hierarchy, balanced spacing, crisp correctly spelled typography, soft glow, subtle depth.',
    story
      ? '- Instagram covers the top 14% and bottom 20% of a story with its own interface: keep the logo, headline, services and CTA between those zones, and keep every important element inside the central 80% of the width.'
      : '- Keep every important element inside a 6% safe margin so nothing is cropped in a phone preview.',
    '',
    ...attachmentLines(parts),
    '',
    ...avoidLines(parts),
  ]
  return tidy(lines)
}

export type CarouselPromptSlide = { role: SlideRole; index: number; total: number; headline: string; body?: string }

export function carouselSlidePrompt(parts: PromptParts, slide: CarouselPromptSlide): string {
  const services = parseServiceList(parts.productsAndServices, 4)
  const position = `slide ${slide.index + 1} of ${slide.total}`
  const exactText = [
    `- Headline text, exactly: "${slide.headline}"`,
    slide.body ? `- Supporting text, exactly: "${slide.body}"` : '',
    slide.role === 'cta' ? `- Button text, exactly: "${parts.callToAction || 'Learn more'}"` : '',
    slide.role === 'cover' ? '- Small pill text, exactly: "Swipe →"' : '',
  ]
  const layout: string[] = []
  if (slide.role === 'cover') {
    layout.push(
      'SLIDE ROLE: COVER. It must stop the scroll and make people swipe.',
      `1. LOGO (top): ${parts.brandName} logo centered${parts.hasLogo ? ' (use the attached logo)' : ' (a clean geometric mark plus the wordmark)'}.`,
      `2. HEADLINE: the cover headline, large, bold, white, centered, max three lines.`,
      `3. HERO SCENE (middle, about 40% of the height): ${HERO_SCENE}`,
      '4. SWIPE CUE (bottom): a rounded pill in the brand color with the text "Swipe →", with the page dots beneath.',
    )
  } else if (slide.role === 'benefit') {
    layout.push(
      `SLIDE ROLE: BENEFIT ${slide.index}. One idea only, easy to read at thumbnail size.`,
      `1. LOGO (top, small): ${parts.brandName} logo centered${parts.hasLogo ? ' (use the attached logo)' : ''}.`,
      `2. NUMBER BADGE: a hexagon outlined in the brand color containing the number ${slide.index}.`,
      '3. HEADLINE: the benefit headline, large, bold, white, centered, max three lines.',
      '4. SUPPORTING TEXT: one or two short lines in soft light blue under the headline.',
      '5. VISUAL (lower area): a single clean line-icon illustration or a tight photographic detail that supports the benefit, glowing in the brand color. No clutter.',
      '6. PAGE DOTS (bottom).',
    )
  } else {
    layout.push(
      'SLIDE ROLE: CALL TO ACTION. The closing slide that tells people what to do next.',
      `1. LOGO (top): large ${parts.brandName} logo centered${parts.hasLogo ? ' (use the attached logo)' : ''}.`,
      '2. HEADLINE: the closing headline, large, bold, white, centered.',
      '3. SUPPORTING TEXT: one short line in soft light blue.',
      `4. SERVICES ROW: ${services.length ? `${services.length} icon + label items for ${services.join(', ')}` : '3 icon + label items for the main services'}, simple line icons in the brand color.`,
      `5. CTA BUTTON (bottom): a rounded button in the brand color with the text "${parts.callToAction || 'Learn more'}", with the page dots beneath.`,
    )
  }
  const lines = [
    `Create ${position} of a polished Instagram carousel for ${parts.brandName}: square 1:1, 1024x1024, a branded poster slide.`,
    'Every slide in this carousel shares one look: the same deep navy gradient, brand-color glows, type, logo placement, icon style and page dots, so the swipe reads as a single designed set.',
    '',
    ...brandLines(parts),
    '',
    ...postLines(parts, slide.role === 'cta'),
    '',
    'THIS SLIDE',
    ...exactText,
    ...layout,
    slide.role === 'cta' ? '' : '- This slide has no call-to-action button, no "learn more" or "see the details" text and no URL.',
    `- Page dots at the bottom: ${slide.total} dots, dot ${slide.index + 1} highlighted in the brand color.`,
    '',
    'STYLE',
    '- High-end dark navy marketing look like a modern web, software or design agency campaign: clear hierarchy, balanced spacing, crisp correctly spelled typography, soft glow.',
    '- Keep every important element inside a 6% safe margin so nothing is cropped in a phone preview.',
    '- Render only the text listed above; no other words, numbers or fake UI text.',
    '',
    ...attachmentLines(parts),
    '',
    ...avoidLines(parts),
  ]
  return tidy(lines)
}

type OpenAiImagePayload = {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string }
}

const IMAGE_SIZE: Record<MediaAspect, string> = { '1:1': '1024x1024', '9:16': '1024x1536' }

async function readOpenAiImage(
  payload: OpenAiImagePayload,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const image = payload.data?.[0]
  if (image?.b64_json) return { bytes: Buffer.from(image.b64_json, 'base64'), mimeType: 'image/png' }
  if (image?.url) {
    const file = await fetchImpl(image.url)
    if (file.ok) {
      const mime = file.headers.get('content-type') || 'image/png'
      return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: mime.split(';')[0] || 'image/png' }
    }
  }
  return null
}

async function generateOpenAiImage(
  prompt: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  size: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  let lastError = 'Image provider failed'
  for (const model of OPENAI_IMAGE_MODELS) {
    const response = await fetchImpl('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality: 'high' }),
    })
    const payload = (await response.json().catch(() => ({}))) as OpenAiImagePayload
    if (!response.ok) {
      lastError = payload.error?.message || lastError
      continue
    }
    const image = await readOpenAiImage(payload, fetchImpl)
    if (image) return image
    lastError = 'Image provider returned no image'
  }
  throw new Error(lastError)
}

type GuideImage = { bytes: Buffer; mimeType: string; name: string }

/** Image edit with the sample and/or logo attached as guiding references. */
async function generateOpenAiImageEdit(
  prompt: string,
  apiKey: string,
  images: GuideImage[],
  fetchImpl: typeof fetch,
  size: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  let lastError = 'Image edit provider failed'
  for (const model of OPENAI_IMAGE_MODELS) {
    const form = new FormData()
    form.set('model', model)
    form.set('prompt', prompt)
    form.set('size', size)
    form.set('quality', 'high')
    for (const image of images) {
      const ext = image.mimeType.includes('jpeg') ? 'jpg' : image.mimeType.includes('webp') ? 'webp' : 'png'
      form.append(
        'image[]',
        new Blob([new Uint8Array(image.bytes)], { type: image.mimeType || 'image/png' }),
        `${image.name}.${ext}`,
      )
    }
    const response = await fetchImpl('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    })
    const payload = (await response.json().catch(() => ({}))) as OpenAiImagePayload
    if (!response.ok) {
      lastError = payload.error?.message || lastError
      continue
    }
    const image = await readOpenAiImage(payload, fetchImpl)
    if (image) return image
    lastError = 'Image edit provider returned no image'
  }
  throw new Error(lastError)
}

/** Center-crops an image to 9:16. Anything ffmpeg cannot decode is returned unchanged. */
export async function cropToStory(result: { bytes: Buffer; mimeType: string }): Promise<{ bytes: Buffer; mimeType: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'story-crop-'))
  try {
    const input = path.join(dir, 'in.img')
    const output = path.join(dir, 'out.png')
    await writeFile(input, result.bytes)
    await runFfmpeg(['-y', '-i', input, '-vf', "crop='trunc(min(iw,ih*9/16)/2)*2':'trunc(ih/2)*2'", '-frames:v', '1', output])
    const bytes = await readFile(output)
    return isDisplayableImage(bytes, 'image/png') ? { bytes, mimeType: 'image/png' } : result
  } catch {
    return result
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function posterOptions(input: MediaRequest, hero: Buffer | null) {
  const slide = input.slide
  const brand = input.brand
  const base = {
    brandName: brand?.name,
    headline: brand?.headline || brand?.name,
    tagline: brand?.tagline,
    services: brand?.services,
    cta: brand?.cta,
    color: brand?.color,
    logo: brand?.logo,
    canvas: (input.aspect === '9:16' ? 'tall' : 'square') as PosterCanvas,
  }
  if (!slide) return { ...base, variant: 'poster' as PosterVariant, hero }
  return {
    ...base,
    variant: slide.role as PosterVariant,
    headline: slide.headline,
    body: slide.body,
    number: slide.index,
    page: { index: slide.index, total: slide.total },
    swipe: slide.role === 'cover',
    hero: slide.role === 'cover' ? hero : null,
  }
}

export class FakeMediaProvider implements MediaProvider {
  imageCalls = 0
  videoCalls = 0
  prompts: string[] = []
  requests: MediaRequest[] = []
  lastRequest: MediaRequest | null = null

  async generateImage(input: MediaRequest): Promise<MediaResult> {
    this.imageCalls += 1
    this.prompts.push(input.prompt)
    this.requests.push(input)
    this.lastRequest = input
    if (!input.composed && input.reference && isDisplayableImage(input.reference.bytes, input.reference.mimeType)) {
      return { bytes: input.reference.bytes, mimeType: input.reference.mimeType }
    }
    return {
      bytes: buildLocalMarketingPng({
        seed: `${input.prompt}#${this.imageCalls}`,
        ...posterOptions(input, null),
        logo: null,
        size: 256,
      }),
      mimeType: 'image/png',
    }
  }

  async generateVideo(input: MediaRequest): Promise<MediaResult> {
    this.videoCalls += 1
    this.prompts.push(input.prompt)
    return { bytes: Buffer.from('fake-mp4'), mimeType: 'video/mp4' }
  }
}

export class HttpMediaProvider implements MediaProvider {
  private localPosterCalls = 0

  constructor(
    private env: Env,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async localPoster(input: MediaRequest, notice?: string): Promise<MediaResult> {
    this.localPosterCalls += 1
    const usable = Boolean(input.reference && isDisplayableImage(input.reference.bytes, input.reference.mimeType))
    if (usable && input.reference && !input.composed) {
      return { bytes: input.reference.bytes, mimeType: input.reference.mimeType, notice, fallback: true }
    }
    const bytes = await renderLocalMarketingPoster({
      seed: `${input.brand?.name || input.prompt}#${input.slide?.index ?? this.localPosterCalls}`,
      ...posterOptions(input, usable ? input.reference!.bytes : null),
    })
    return { bytes, mimeType: 'image/png', notice, fallback: true }
  }

  async generateImage(input: MediaRequest): Promise<MediaResult> {
    const key = input.openaiOff ? '' : input.apiKey || this.env.MEDIA_PROVIDER_KEY
    const sampleKept = !input.composed
    if (!key || input.forceLocal) {
      if (input.forceLocal) return this.localPoster(input)
      if (input.openaiOff) {
        const keepsSample = Boolean(input.reference) && sampleKept
        return this.localPoster(input, `${OPENAI_OFF_NOTICE}, so ${keepsSample ? 'the preview is your sample photo' : 'this is the local brand poster'}.`)
      }
      return this.localPoster(input, input.reference && sampleKept ? undefined : 'No OpenAI key is saved, so this is the local brand poster.')
    }
    const size = IMAGE_SIZE[input.aspect ?? '1:1']
    const guides: GuideImage[] = []
    if (input.reference && isDisplayableImage(input.reference.bytes, input.reference.mimeType)) {
      guides.push({ ...input.reference, name: 'sample' })
    }
    const referenceUsed = guides.length > 0
    const logo = input.brand?.logo
    if (logo?.length) {
      const mimeType = sniffImageMime(logo)
      if (isDisplayableImage(logo, mimeType)) guides.push({ bytes: logo, mimeType, name: 'logo' })
    }
    if (input.styleGuide && isDisplayableImage(input.styleGuide.bytes, input.styleGuide.mimeType)) {
      guides.push({ ...input.styleGuide, name: 'style' })
    }
    try {
      let image: { bytes: Buffer; mimeType: string }
      if (guides.length) {
        try {
          image = await generateOpenAiImageEdit(input.prompt, key, guides, this.fetchImpl, size)
        } catch (error) {
          if (referenceUsed && sampleKept) throw error
          image = await generateOpenAiImage(input.prompt, key, this.fetchImpl, size)
        }
      } else {
        image = await generateOpenAiImage(input.prompt, key, this.fetchImpl, size)
      }
      return input.aspect === '9:16' ? await cropToStory(image) : image
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Image provider failed'
      const fallback = referenceUsed && sampleKept ? 'showing your sample photo instead' : 'showing the local brand poster instead'
      return this.localPoster(input, `OpenAI image generation failed (${clip(reason, 140)}); ${fallback}.`)
    }
  }

  async generateVideo(): Promise<MediaResult> {
    throw new Error('Video files are rendered by the video studio')
  }
}

export function createMediaProvider(env: Env): MediaProvider {
  // Always Http so admin/customer OpenAI keys passed as apiKey work even when MEDIA_PROVIDER_KEY is empty.
  // With no key, generateImage returns the sample (if any) or a finished local brand poster.
  return new HttpMediaProvider(env)
}
