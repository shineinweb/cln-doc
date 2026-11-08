import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Prisma, Template } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { audit } from '../audit'
import { decryptString } from '../crypto'
import { isDisplayableImage, runFfmpeg } from '../providers/poster'
import { OPENAI_OFF_NOTICE, readProviderSecrets } from '../settings'
import { assertQuota, requireWritable, type CustomerContext } from './context'
import { generateCopyForPost, loadBrand, loadBrandKit, startMediaJob } from './content'
import { assertFaceFeature, resolveFace } from './faces'
import {
  formatFor,
  readSlots,
  readTemplateAsset,
  renderTemplateImage,
  type TextSlot,
} from './templates'

export const AI_LABEL_NOTE = 'Made with AI from a template. Some networks ask you to label AI-generated or edited media, so switch on the AI label there before you publish.'

export const personalizeBodySchema = z.object({
  values: z.record(z.string()).default({}),
  faceAssetId: z.string().min(1).max(191).optional(),
  consent: z.boolean().optional(),
  useBrandKit: z.boolean().default(true),
})

export type PersonalizeBody = z.infer<typeof personalizeBodySchema>

export type TemplateValues = {
  values: Record<string, string>
  faceAssetId: string | null
  aiGenerated: true
  aiNote: string
  templateTitle: string
}

export function validateValues(slots: TextSlot[], given: Record<string, string>): Record<string, string> {
  const known = new Set(slots.map((slot) => slot.key))
  for (const key of Object.keys(given)) {
    if (!known.has(key)) throw new ApiError(400, 'validation', `This template has no text field named "${key}"`)
  }
  const out: Record<string, string> = {}
  for (const slot of slots) {
    const value = (given[slot.key] ?? slot.default).trim()
    if (value.length > slot.maxLength) {
      throw new ApiError(400, 'validation', `"${slot.label}" can be at most ${slot.maxLength} characters`)
    }
    if (slot.required && !value) throw new ApiError(400, 'validation', `"${slot.label}" is required`)
    out[slot.key] = value
  }
  return out
}

function describe(slots: TextSlot[], values: Record<string, string>, title: string): string {
  const order: TextSlot['position'][] = ['headline', 'subline', 'cta', 'badge']
  const lines = order.flatMap((position) => slots.filter((slot) => slot.position === position).map((slot) => values[slot.key] ?? '').filter(Boolean))
  return (lines.length ? lines.join('\n') : title).slice(0, 4000)
}

function valueFor(slots: TextSlot[], values: Record<string, string>, position: TextSlot['position']): string {
  const slot = slots.find((item) => item.position === position)
  return slot ? (values[slot.key] ?? '').trim() : ''
}

async function fitBanner(bytes: Buffer, width: number, height: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'face-banner-'))
  try {
    const input = path.join(dir, 'in.img')
    const output = path.join(dir, 'out.png')
    await writeFile(input, bytes)
    const graph = [
      '[0:v]split[a][b]',
      `[a]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},gblur=sigma=28[bg]`,
      `[b]scale=-2:${height}:force_original_aspect_ratio=decrease[fg]`,
      '[bg][fg]overlay=(W-w)/2:(H-h)/2[out]',
    ].join(';')
    await runFfmpeg(['-y', '-i', input, '-filter_complex', graph, '-map', '[out]', '-frames:v', '1', output])
    const fitted = await readFile(output)
    return isDisplayableImage(fitted, 'image/png') ? fitted : bytes
  } catch {
    return bytes
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export function bannerSize(orientation: string): { width: number; height: number } {
  return orientation === 'portrait' ? { width: 1350, height: 660 } : { width: 1290, height: 495 }
}

export function facePrompt(template: Pick<Template, 'title' | 'category'>): string {
  return [
    `Create a polished, friendly marketing portrait for the template "${template.title}"${template.category ? ` (${template.category})` : ''}.`,
    'Attached image 1 is a photo of the person who must appear. Keep their face, hair, skin tone, and likeness clearly recognizable. Do not change who they are.',
    'Attached image 2 is the template style guide. Reuse its colors, lighting, and mood for the backdrop.',
    'Show the person from the shoulders up, centered, well lit, looking toward the camera, with plenty of empty backdrop on both sides.',
    'No text, no logos, no watermarks, no other people, nothing misleading.',
  ].join('\n')
}

type ImageAccess = { key: string | undefined; openaiOff: boolean }

async function imageAccess(deps: Deps, ctx: CustomerContext): Promise<ImageAccess> {
  const secrets = await readProviderSecrets(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY)
  const platform = secrets.openaiKey || deps.env.MEDIA_PROVIDER_KEY || undefined
  let key = secrets.enabled.openai ? platform : undefined
  let own = false
  if (ctx.subscription.package.customAi && ctx.settings.features.customAi) {
    const profile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: ctx.organization.id } })
    if (profile?.providerKeyEnc) {
      key = decryptString(profile.providerKeyEnc, deps.env.TOKEN_ENCRYPTION_KEY)
      own = true
    }
  }
  return { key, openaiOff: !secrets.enabled.openai && !own && Boolean(platform) }
}

async function buildHero(
  deps: Deps,
  template: Template,
  face: { bytes: Buffer; mimeType: string } | null,
  source: { bytes: Buffer; mimeType: string } | null,
  access: ImageAccess,
): Promise<{ hero: Buffer | null; notice?: string; usedAi: boolean }> {
  const size = bannerSize(template.orientation)
  if (!face) return { hero: source?.bytes ?? null, usedAi: false }
  if (!access.key) {
    const why = access.openaiOff ? OPENAI_OFF_NOTICE : 'No OpenAI key is saved'
    return {
      hero: await fitBanner(face.bytes, size.width, size.height),
      notice: `${why}, so your photo is placed in the template as it is, without an AI likeness edit.`,
      usedAi: false,
    }
  }
  const generated = await deps.media.generateImage({
    prompt: facePrompt(template),
    apiKey: access.key,
    reference: face,
    styleGuide: source ?? undefined,
    aspect: '1:1',
  })
  const hero = await fitBanner(generated.bytes, size.width, size.height)
  return {
    hero,
    notice: generated.fallback ? generated.notice ?? 'The AI likeness edit could not run, so your photo is placed in the template as it is.' : generated.notice,
    usedAi: !generated.fallback,
  }
}

type Prepared = {
  slots: TextSlot[]
  values: Record<string, string>
  hero: Buffer | null
  notices: string[]
  usedAi: boolean
  frame: Buffer
  face: Awaited<ReturnType<typeof resolveFace>> | null
  brandName: string
}

async function prepare(
  deps: Deps,
  ctx: CustomerContext,
  template: Template,
  body: PersonalizeBody,
  options: { size: number; withAi: boolean },
): Promise<Prepared> {
  const slots = readSlots(template.textSlots)
  const values = validateValues(slots, body.values)
  let face: Prepared['face'] = null
  if (body.faceAssetId) {
    if (!template.hasFaceSlot) throw new ApiError(400, 'validation', 'This template has no place for a face photo')
    face = await resolveFace(deps, ctx, body.faceAssetId, body.consent)
  }
  const source = await readTemplateAsset(deps, template.sourceAssetId)
  const access = await imageAccess(deps, ctx)
  const notices: string[] = []
  let hero: Buffer | null
  let usedAi = false
  if (face && options.withAi) {
    if (access.key) await assertQuota(deps, ctx, 'image')
    const built = await buildHero(deps, template, face, source, access)
    hero = built.hero
    usedAi = built.usedAi
    if (built.notice) notices.push(built.notice)
  } else if (face) {
    const size = bannerSize(template.orientation)
    hero = await fitBanner(face.bytes, size.width, size.height)
  } else {
    hero = source?.bytes ?? null
  }
  const kit = body.useBrandKit ? await loadBrandKit(deps, ctx.organization.id) : null
  const brand = body.useBrandKit ? await loadBrand(deps, ctx.organization.id, ctx.organization.name) : null
  const brandName = brand?.brandName || ctx.organization.name
  const frame = await renderTemplateImage({
    orientation: template.orientation,
    slots,
    values,
    hero,
    size: options.size,
    accent: kit?.primaryColor ?? template.accentColor,
    brandName,
    logo: kit?.logo ?? null,
    fallbackBadge: template.category,
    seed: `${template.id}-${ctx.organization.id}`,
  })
  return { slots, values, hero, notices, usedAi, frame, face, brandName }
}

export async function previewTemplate(deps: Deps, ctx: CustomerContext, template: Template, body: PersonalizeBody): Promise<string> {
  const faceId = body.consent === true && ctx.settings.features.facePersonalization ? body.faceAssetId : undefined
  const prepared = await prepare(deps, ctx, template, { ...body, faceAssetId: faceId }, { size: 540, withAi: false })
  return `data:image/png;base64,${prepared.frame.toString('base64')}`
}

export async function personalizeTemplate(deps: Deps, ctx: CustomerContext, template: Template, body: PersonalizeBody) {
  requireWritable(ctx)
  if (body.faceAssetId) assertFaceFeature(ctx)
  const video = template.kind === 'video'
  const format = formatFor(template.kind, template.orientation)
  if (video && !ctx.settings.features.videoGeneration) {
    throw new ApiError(403, 'feature_disabled', 'Video generation is turned off for the whole site')
  }
  if (!video) await assertQuota(deps, ctx, 'image')
  const prepared = await prepare(deps, ctx, template, body, { size: 1080, withAi: true })
  const { slots, values } = prepared
  const templateValues: TemplateValues = {
    values,
    faceAssetId: prepared.face?.asset.id ?? null,
    aiGenerated: true,
    aiNote: AI_LABEL_NOTE,
    templateTitle: template.title,
  }
  const cta = valueFor(slots, values, 'cta')
  const post = await deps.prisma.post.create({
    data: {
      organizationId: ctx.organization.id,
      format,
      description: describe(slots, values, template.title),
      caption: '',
      generatedCaption: '',
      keywords: [],
      hashtags: [],
      alternativeCaptions: [],
      factualClaims: [],
      durationSeconds: video ? template.durationSeconds : null,
      aiInstructions: video ? template.motionPrompt : '',
      callToAction: cta || null,
      generateCaption: true,
      adNetworks: [],
      templateId: template.id,
      templateValues: templateValues as unknown as Prisma.InputJsonValue,
    },
  })
  const cleanup = async () => {
    await deps.prisma.generationJob.deleteMany({ where: { postId: post.id } })
    await deps.prisma.postMedia.deleteMany({ where: { postId: post.id } })
    await deps.prisma.post.deleteMany({ where: { id: post.id } })
  }
  let jobId: string
  let copyError: string | undefined
  try {
    const storageKey = await deps.storage.put(prepared.frame, 'png')
    const asset = await deps.prisma.mediaAsset.create({
      data: {
        organizationId: ctx.organization.id,
        kind: video ? 'reference' : 'generated_image',
        storageKey,
        mimeType: 'image/png',
        filename: video ? `${template.title}-first-frame.png` : `${template.title}.png`,
      },
    })
    if (prepared.usedAi) {
      await deps.prisma.aiUsage.create({ data: { organizationId: ctx.organization.id, kind: 'image', tokens: 0 } })
    }
    if (video) {
      const started = await startMediaJob(deps, ctx, post.id, asset.id)
      jobId = started.jobId
      copyError = started.copyError
      if (prepared.notices.length) {
        const job = await deps.prisma.generationJob.findUnique({ where: { id: jobId } })
        if (job && job.status === 'ready') {
          const merged = [...prepared.notices, job.error].filter(Boolean).join(' ')
          await deps.prisma.generationJob.update({ where: { id: jobId }, data: { error: merged } })
        }
      }
    } else {
      await deps.prisma.postMedia.create({ data: { postId: post.id, mediaAssetId: asset.id, position: 0 } })
      if (!prepared.usedAi) {
        await deps.prisma.aiUsage.create({ data: { organizationId: ctx.organization.id, kind: 'image', tokens: 0 } })
      }
      const job = await deps.prisma.generationJob.create({
        data: {
          organizationId: ctx.organization.id,
          postId: post.id,
          kind: 'image',
          status: 'ready',
          error: prepared.notices.join(' ') || null,
        },
      })
      jobId = job.id
      try {
        await generateCopyForPost(deps, ctx, post.id)
      } catch (error) {
        copyError = error instanceof ApiError ? error.message : 'The caption could not be generated'
      }
    }
  } catch (error) {
    await cleanup()
    if (error instanceof ApiError) throw error
    const message = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 160) : ''
    throw new ApiError(502, 'generation_failed', `The ${video ? 'video' : 'image'} could not be personalized${message ? `: ${message}` : '. Try again.'}`)
  }
  await deps.prisma.template.update({ where: { id: template.id }, data: { useCount: { increment: 1 } } })
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: 'user',
    actorId: ctx.user.id,
    action: 'template.personalized',
    targetType: 'template',
    targetId: template.id,
    metadata: { postId: post.id, kind: template.kind, face: Boolean(prepared.face) },
  })
  if (prepared.face) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'face.used',
      targetType: 'media',
      targetId: prepared.face.asset.id,
      metadata: { templateId: template.id, postId: post.id },
    })
  }
  return { postId: post.id, jobId, copyError }
}
