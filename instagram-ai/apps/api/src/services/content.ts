import {
  SYSTEM_PROMPT,
  claimsBlockPublish,
  composePublishCaption,
  defaultDuration,
  durationAllowed,
  findForbiddenIntents,
  normalizeHashtags,
  normalizeHexColor,
  normalizeKeywords,
  parseHashtags,
  reviewClaims,
  stripForbiddenLines,
  type HashtagChip,
  type ReviewedClaim,
} from '@instagram-ai/shared'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { decryptString } from '../crypto'
import { carouselSlidePrompt, isDisplayableImage, marketingImagePrompt, parseServiceList, type MediaRequest } from '../providers/media'
import { planCarousel } from '../providers/carousel'
import { chooseVideoRoute, produceClip, videoOffNotice } from '../providers/video'
import { OPENAI_OFF_NOTICE, readProviderSecrets } from '../settings'
import { audit } from '../audit'
import type { BrandContext } from '../providers/text'
import { assertQuota, asStringArray, requireWritable, type CustomerContext } from './context'
import { usableToken } from './instagram'
import { publishTargets } from './targets'

const copySchema = z.object({
  caption: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  hashtags: z.array(z.string()).optional().default([]),
  creativeBrief: z.string().optional().default(''),
  callToAction: z.string().optional().default(''),
  alternativeCaptions: z.array(z.string()).optional().default([]),
  factualClaims: z.array(z.union([z.string(), z.object({ claim: z.string() })])).optional().default([]),
  carouselOutline: z.array(z.string()).optional(),
  reelScript: z.string().optional(),
  calendarIdeas: z.array(z.object({ day: z.string(), idea: z.string() })).optional(),
})

export function parseClaims(value: unknown): ReviewedClaim[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('claim' in item)) return []
    const claim = String((item as { claim?: unknown }).claim ?? '').trim()
    if (!claim) return []
    return [{
      claim,
      needsReview: Boolean((item as { needsReview?: boolean }).needsReview),
      accepted: Boolean((item as { accepted?: boolean }).accepted),
    }]
  })
}

export async function loadBrandKit(deps: Deps, organizationId: string) {
  const org = await deps.prisma.organization.findUnique({ where: { id: organizationId } })
  const hashtags = normalizeHashtags(asStringArray(org?.brandHashtags)).map((chip) => chip.tag)
  let logo: Buffer | null = null
  let logoUrl: string | null = null
  if (org?.brandLogoAssetId) {
    const asset = await deps.prisma.mediaAsset.findFirst({
      where: { id: org.brandLogoAssetId, organizationId },
    })
    if (asset) {
      logoUrl = deps.storage.url(asset.storageKey)
      const file = await deps.storage.read(asset.storageKey)
      if (file && isDisplayableImage(file.bytes, asset.mimeType || file.mimeType)) logo = file.bytes
    }
  }
  return {
    primaryColor: normalizeHexColor(org?.brandPrimaryColor),
    hashtags,
    logo,
    logoUrl,
  }
}

export async function loadBrand(deps: Deps, organizationId: string, fallbackName: string): Promise<BrandContext> {
  const row = await deps.prisma.brandProfile.findUnique({ where: { organizationId } })
  return {
    brandName: row?.brandName || fallbackName,
    businessDescription: row?.businessDescription ?? '',
    targetAudience: row?.targetAudience ?? '',
    voiceAndTone: row?.voiceAndTone ?? '',
    productsAndServices: row?.productsAndServices ?? '',
    approvedFacts: asStringArray(row?.approvedFacts),
    topicsToAvoid: row?.topicsToAvoid ?? '',
    preferredLanguage: row?.preferredLanguage || 'en',
  }
}

function mediaDescription(format: string, description: string, filename?: string): string {
  const kind = format === 'reel' || format === 'video' ? 'video' : format === 'carousel' ? 'carousel' : format === 'story' ? 'story' : 'photo'
  return [kind, description, filename ? `file ${filename}` : ''].filter(Boolean).join('. ')
}

export async function generateCopyForPost(deps: Deps, ctx: CustomerContext, postId: string): Promise<void> {
  requireWritable(ctx)
  await assertQuota(deps, ctx, 'text')
  const post = await deps.prisma.post.findFirst({
    where: { id: postId, organizationId: ctx.organization.id },
    include: { media: { include: { asset: true }, orderBy: { position: 'asc' } } },
  })
  if (!post) throw new ApiError(404, 'not_found', 'Post not found')
  const category = post.categoryId
    ? await deps.prisma.contentCategory.findFirst({ where: { id: post.categoryId, organizationId: ctx.organization.id } })
    : null
  const brand = await loadBrand(deps, ctx.organization.id, ctx.organization.name)
  const knowledge = await deps.prisma.aiKnowledge.findMany({
    where: { organizationId: ctx.organization.id, approved: true },
  })
  const profile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: ctx.organization.id } })
  const custom = ctx.subscription.package.customAi && ctx.settings.features.customAi
  const postNotes = [
    post.aiInstructions,
    post.aiTone ? `Tone: ${post.aiTone}` : '',
    post.aiLanguage ? `Language: ${post.aiLanguage}` : '',
  ].filter(Boolean).join('\n')
  const instructions = [custom ? profile?.extraInstructions ?? '' : '', postNotes].filter(Boolean).join('\n')
  const blocked = findForbiddenIntents(instructions)
  if (blocked.length) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'ai.blocked_intent',
      targetType: 'post',
      targetId: post.id,
      metadata: { intents: blocked },
    })
  }
  let apiKey: string | undefined
  if (custom && profile?.providerKeyEnc) {
    apiKey = decryptString(profile.providerKeyEnc, deps.env.TOKEN_ENCRYPTION_KEY)
  }
  const model = custom && profile?.modelId ? profile.modelId : 'platform-default'
  const raw = await deps.text.complete({
    kind: 'post_copy',
    system: SYSTEM_PROMPT,
    brand,
    instructions,
    approvedKnowledge: knowledge.map((item) => ({ title: item.title, body: item.body })),
    content: {
      category: category?.name,
      styleNotes: category?.styleNotes,
      description: post.description,
      mediaDescription: mediaDescription(post.format, post.description, post.media[0]?.asset.filename),
      language: post.aiLanguage || undefined,
      tone: post.aiTone || undefined,
      aiInstructions: post.aiInstructions || undefined,
    },
    model,
    apiKey,
  })
  const parsed = copySchema.parse(raw)
  const claims = reviewClaims(
    parsed.factualClaims.map((claim) => (typeof claim === 'string' ? claim : claim.claim)),
    brand.approvedFacts,
  )
  const caption = stripForbiddenLines(parsed.caption)
  await deps.prisma.post.update({
    where: { id: post.id },
    data: {
      caption,
      generatedCaption: caption,
      keywords: normalizeKeywords(parsed.keywords),
      hashtags: normalizeHashtags(parsed.hashtags) as unknown as Prisma.InputJsonValue,
      creativeBrief: parsed.creativeBrief,
      callToAction: parsed.callToAction,
      alternativeCaptions: parsed.alternativeCaptions.map((item) => stripForbiddenLines(item)),
      factualClaims: claims as unknown as Prisma.InputJsonValue,
      approvedAt: null,
      approvedById: null,
      status: post.status === 'PUBLISHED' ? post.status : 'DRAFT',
    },
  })
  await deps.prisma.aiUsage.create({
    data: { organizationId: ctx.organization.id, kind: 'text', tokens: caption.length },
  })
}

export async function generateIdea(
  deps: Deps,
  ctx: CustomerContext,
  kind: 'carousel_outline' | 'reel_script' | 'calendar_ideas',
  brief: string,
): Promise<unknown> {
  requireWritable(ctx)
  await assertQuota(deps, ctx, 'text')
  const brand = await loadBrand(deps, ctx.organization.id, ctx.organization.name)
  const knowledge = await deps.prisma.aiKnowledge.findMany({
    where: { organizationId: ctx.organization.id, approved: true },
  })
  const raw = await deps.text.complete({
    kind,
    system: SYSTEM_PROMPT,
    brand,
    instructions: '',
    approvedKnowledge: knowledge.map((item) => ({ title: item.title, body: item.body })),
    content: { description: brief },
    model: 'platform-default',
  })
  await deps.prisma.aiUsage.create({
    data: { organizationId: ctx.organization.id, kind: 'text', tokens: brief.length },
  })
  return copySchema.parse(raw)
}

async function referenceFor(deps: Deps, organizationId: string, referenceAssetId?: string | null) {
  if (!referenceAssetId) return null
  const asset = await deps.prisma.mediaAsset.findFirst({ where: { id: referenceAssetId, organizationId } })
  if (!asset) throw new ApiError(404, 'not_found', 'Reference photo not found')
  return asset
}

function isVideoFormat(format: string): boolean {
  return format === 'reel' || format === 'video'
}

export function checkedDuration(format: string, duration: number | undefined): number | null {
  if (!isVideoFormat(format)) return null
  const value = duration ?? defaultDuration(format) ?? 8
  if (!durationAllowed(format, value)) {
    throw new ApiError(400, 'validation', format === 'reel'
      ? 'A Reel can be 4, 8, or 12 seconds'
      : 'A video can be 8, 15, or 30 seconds')
  }
  return value
}

async function attachGeneratedVideo(deps: Deps, postId: string, mediaAssetId: string): Promise<void> {
  await deps.prisma.$transaction(async (tx) => {
    const linked = await tx.postMedia.findMany({ where: { postId }, include: { asset: true } })
    const staleIds = linked
      .filter((item) => item.asset.kind === 'generated_image' || item.asset.kind === 'generated_video')
      .map((item) => item.id)
    if (staleIds.length) await tx.postMedia.deleteMany({ where: { id: { in: staleIds } } })
    const kept = await tx.postMedia.findMany({ where: { postId }, orderBy: { position: 'desc' } })
    for (const item of kept) {
      await tx.postMedia.update({ where: { id: item.id }, data: { position: item.position + 1 } })
    }
    await tx.postMedia.create({ data: { postId, mediaAssetId, position: 0 } })
  })
}

function firstSentence(text: string, max = 96): string {
  const line = text.split(/\r?\n/).map((part) => part.trim()).find(Boolean) ?? ''
  if (line.length <= max) return line
  const sentence = line.split(/(?<=[.!?])\s+/)[0] ?? line
  return sentence.length <= max ? sentence : line
}

async function plannedSlides(
  deps: Deps,
  post: { organizationId: string; description: string; callToAction: string | null },
  organizationName: string,
) {
  const brand = await loadBrand(deps, post.organizationId, organizationName)
  return planCarousel({
    brandName: brand.brandName,
    description: post.description,
    tagline: brand.businessDescription ? brand.businessDescription.split(/\r?\n/)[0] : null,
    services: parseServiceList(brand.productsAndServices, 4),
    callToAction: post.callToAction,
  })
}

async function displayableReference(deps: Deps, storageKey: string, mimeType: string): Promise<boolean> {
  const file = await deps.storage.read(storageKey)
  return Boolean(file && isDisplayableImage(file.bytes, mimeType || file.mimeType))
}

export async function startMediaJob(
  deps: Deps,
  ctx: CustomerContext,
  postId: string,
  referenceAssetId?: string | null,
): Promise<{ jobId: string; copyError?: string }> {
  requireWritable(ctx)
  const post = await deps.prisma.post.findFirst({ where: { id: postId, organizationId: ctx.organization.id } })
  if (!post) throw new ApiError(404, 'not_found', 'Post not found')
  const resolvedReferenceId = referenceAssetId === undefined ? post.referenceAssetId : referenceAssetId
  const reference = await referenceFor(deps, ctx.organization.id, resolvedReferenceId)
  const video = isVideoFormat(post.format)
  const previewReference = !video && reference
    ? await displayableReference(deps, reference.storageKey, reference.mimeType)
    : false
  if (video && !ctx.settings.features.videoGeneration) {
    throw new ApiError(403, 'feature_disabled', 'Video generation is turned off for the whole site')
  }
  if (!video && !previewReference) {
    const count = post.format === 'carousel'
      ? (await plannedSlides(deps, post, ctx.organization.name)).length
      : 1
    await assertQuota(deps, ctx, 'image', count)
  }
  if (reference) {
    await deps.prisma.post.update({ where: { id: post.id }, data: { referenceAssetId: reference.id } })
  } else if (referenceAssetId === null && post.referenceAssetId) {
    await deps.prisma.post.update({ where: { id: post.id }, data: { referenceAssetId: null } })
  }
  const job = await deps.prisma.generationJob.create({
    data: { organizationId: ctx.organization.id, postId: post.id, kind: video ? 'video' : 'image', status: 'queued' },
  })
  if (video && !deps.inlineJobs) {
    void processGenerationJob(deps, job.id).catch((error) => {
      deps.logger.error({ err: error, jobId: job.id }, 'video generation failed')
    })
    return { jobId: job.id }
  }
  const copyError = await processGenerationJob(deps, job.id, ctx)
  return { jobId: job.id, copyError }
}

export async function processGenerationJob(deps: Deps, jobId: string, ctx?: CustomerContext): Promise<string | undefined> {
  const claimed = await deps.prisma.generationJob.updateMany({
    where: { id: jobId, status: { in: ['queued', 'failed'] } },
    data: { status: 'running', error: null },
  })
  if (claimed.count === 0) return
  const job = await deps.prisma.generationJob.findUnique({ where: { id: jobId } })
  if (!job?.postId) return
  const post = await deps.prisma.post.findUnique({ where: { id: job.postId } })
  if (!post) return
  const organization = await deps.prisma.organization.findUnique({ where: { id: job.organizationId } })
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: job.organizationId },
    include: { package: true },
  })
  if (!organization || !subscription) return
  const settings = ctx?.settings ?? (await (await import('../settings')).loadSettings(deps.prisma, deps.env.META_REDIRECT_URI))
  const acting = ctx ?? {
    user: { id: 'system', email: '', name: 'system' },
    organization,
    membership: { id: 'system', role: 'OWNER' as const },
    subscription,
    settings,
  }
  try {
    const secrets = await readProviderSecrets(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY)
    const video = job.kind === 'video' || isVideoFormat(post.format)
    const routing = {
      providerUrl: secrets.videoProviderUrl,
      runwayKey: secrets.runwayKey,
      providerEnabled: secrets.enabled.videoProvider,
      runwayEnabled: secrets.enabled.runway,
    }
    let route = video ? chooseVideoRoute(routing) : null
    let previewNote: string | undefined
    if (video && route && route !== 'local') {
      if (!subscription.package.videoGeneration) {
        previewNote = `${subscription.package.name} does not include generated video, so this preview is the local designed ad.`
        route = 'local'
      } else {
        try {
          await assertQuota(deps, acting, 'video', 1)
        } catch (error) {
          if (error instanceof ApiError && error.code === 'quota_exceeded') {
            previewNote = 'The monthly video quota is used up, so this preview is the local designed ad.'
            route = 'local'
          } else {
            throw error
          }
        }
      }
    } else if (video && route === 'local') {
      const off = videoOffNotice(routing)
      previewNote = off
        ? `${off}, so this preview is the local designed ad.`
        : 'No Runway key is stored, so this preview is the local designed ad.'
    }
    const reference = await referenceFor(deps, post.organizationId, post.referenceAssetId)
    const referenceFile = reference ? await deps.storage.read(reference.storageKey) : null
    const referenceOk = Boolean(reference && referenceFile && isDisplayableImage(referenceFile.bytes, reference.mimeType || referenceFile.mimeType))
    if (video && !settings.features.videoGeneration) {
      throw new ApiError(403, 'feature_disabled', 'Video generation is turned off for the whole site')
    }
    const composed = !video && (post.format === 'carousel' || post.format === 'story')
    const slides = !video && post.format === 'carousel' ? await plannedSlides(deps, post, organization.name) : null
    const count = slides ? slides.length : 1
    const platformImageKey = secrets.enabled.openai ? secrets.openaiKey || deps.env.MEDIA_PROVIDER_KEY || undefined : undefined
    let imageKey = platformImageKey
    let ownImageKey = false
    if (!video) {
      const imageProfile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: post.organizationId } })
      if (subscription.package.customAi && settings.features.customAi && imageProfile?.providerKeyEnc) {
        imageKey = decryptString(imageProfile.providerKeyEnc, deps.env.TOKEN_ENCRYPTION_KEY)
        ownImageKey = true
      }
    }
    const openaiOff = !secrets.enabled.openai && !ownImageKey && Boolean(secrets.openaiKey || deps.env.MEDIA_PROVIDER_KEY)
    let useImageProvider = !video && (composed || !referenceOk || Boolean(imageKey))
    const imageNotices = new Set<string>()
    if (useImageProvider) {
      try {
        await assertQuota(deps, acting, 'image', count)
      } catch (error) {
        if (referenceOk && error instanceof ApiError && error.code === 'quota_exceeded') {
          useImageProvider = false
          imageNotices.add('The monthly image quota is used up, so the preview is your sample photo.')
        } else {
          throw error
        }
      }
    }
    let copyError: string | undefined
    if ((video || composed) && post.generateCaption !== false) {
      try {
        await generateCopyForPost(deps, acting, post.id)
      } catch (error) {
        copyError = error instanceof ApiError ? error.message : 'The caption could not be generated'
      }
    }
    const fresh = await deps.prisma.post.findUnique({ where: { id: post.id } })
    const current = fresh ?? post
    if (video && route) {
      const length = current.durationSeconds ?? defaultDuration(current.format) ?? 8
      const kit = await loadBrandKit(deps, post.organizationId)
      const brand = await loadBrand(deps, post.organizationId, organization.name)
      const clip = await produceClip({
        format: current.format === 'video' ? 'video' : 'reel',
        length,
        description: current.description,
        instructions: current.aiInstructions ?? '',
        callToAction: current.callToAction,
        caption: current.caption,
        reference: referenceOk && referenceFile ? { bytes: referenceFile.bytes, mimeType: referenceFile.mimeType } : null,
        runwayKey: route === 'runway' ? secrets.runwayKey : null,
        providerUrl: route === 'provider' ? secrets.videoProviderUrl : null,
        runwayEnabled: secrets.enabled.runway,
        providerEnabled: secrets.enabled.videoProvider,
        openaiEnabled: secrets.enabled.openai,
        openaiKey: secrets.openaiKey || deps.env.MEDIA_PROVIDER_KEY || null,
        brandColor: kit.primaryColor,
        logo: kit.logo,
        brandLine: brand.brandName,
        tagline: brand.businessDescription ? brand.businessDescription.split(/\r?\n/)[0] : null,
        services: parseServiceList(brand.productsAndServices, 3),
      }, deps.videoFetch)
      const storageKey = await deps.storage.put(clip.bytes, 'mp4')
      const asset = await deps.prisma.mediaAsset.create({
        data: {
          organizationId: post.organizationId,
          kind: 'generated_video',
          storageKey,
          mimeType: clip.mimeType,
          filename: `${current.format}.${clip.route}.mp4`,
        },
      })
      await attachGeneratedVideo(deps, post.id, asset.id)
      if (clip.route !== 'local') {
        await deps.prisma.aiUsage.create({ data: { organizationId: post.organizationId, kind: 'video', tokens: 0 } })
      }
      const voiceNote = openaiOff && !(clip.notice ?? previewNote)?.includes(OPENAI_OFF_NOTICE)
        ? `${OPENAI_OFF_NOTICE}, so the voiceover uses the built-in voice.`
        : undefined
      const explanation = [clip.notice ?? previewNote, voiceNote, copyError].filter(Boolean).join(' ')
      await deps.prisma.generationJob.update({
        where: { id: job.id },
        data: { status: 'ready', error: explanation || null },
      })
      return copyError
    }
    if (referenceOk && reference && !useImageProvider) {
      if (openaiOff && !imageNotices.size) imageNotices.add(`${OPENAI_OFF_NOTICE}, so the preview is your sample photo.`)
      // No OpenAI key (or quota): the sample is the Photo/Carousel visual, never a drawn stand-in.
      const linked = await deps.prisma.postMedia.findFirst({ where: { postId: post.id, mediaAssetId: reference.id } })
      if (!linked) {
        const prior = await deps.prisma.postMedia.findMany({ where: { postId: post.id }, include: { asset: true } })
        const staleIds = prior.filter((item) => item.asset.kind === 'generated_image').map((item) => item.id)
        if (staleIds.length) await deps.prisma.postMedia.deleteMany({ where: { id: { in: staleIds } } })
        await deps.prisma.postMedia.create({ data: { postId: post.id, mediaAssetId: reference.id, position: 0 } })
      }
    } else {
      const category = post.categoryId
        ? await deps.prisma.contentCategory.findFirst({ where: { id: post.categoryId, organizationId: post.organizationId } })
        : null
      const brand = await loadBrand(deps, post.organizationId, organization.name)
      const kit = await loadBrandKit(deps, post.organizationId)
      const apiKey = imageKey
      const callToAction = current.callToAction || post.callToAction
      const promptParts = {
        brandName: brand.brandName,
        description: current.description,
        businessDescription: brand.businessDescription,
        productsAndServices: brand.productsAndServices,
        voiceAndTone: brand.voiceAndTone,
        primaryColor: kit.primaryColor,
        category: category?.name,
        styleNotes: category?.styleNotes,
        instructions: post.aiInstructions,
        tone: post.aiTone,
        language: post.aiLanguage,
        topicsToAvoid: brand.topicsToAvoid,
        targetAudience: brand.targetAudience,
        callToAction,
        hasLogo: Boolean(kit.logo),
      }
      const aspect = post.format === 'story' ? '9:16' as const : '1:1' as const
      const mediaBrand = {
        name: brand.brandName,
        headline: (composed ? firstSentence(current.description) : '') || current.description.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || brand.brandName,
        tagline: brand.businessDescription ? brand.businessDescription.split(/\r?\n/)[0] : undefined,
        services: parseServiceList(brand.productsAndServices, 3),
        cta: callToAction || undefined,
        color: kit.primaryColor,
        logo: kit.logo,
      }
      const referencePayload = reference && referenceFile
        ? { bytes: referenceFile.bytes, mimeType: reference.mimeType || referenceFile.mimeType }
        : undefined
      const prior = await deps.prisma.postMedia.findMany({ where: { postId: post.id }, include: { asset: true } })
      const staleIds = prior.filter((item) => item.asset.kind === 'generated_image').map((item) => item.id)
      if (staleIds.length) await deps.prisma.postMedia.deleteMany({ where: { id: { in: staleIds } } })
      let styleGuide: MediaRequest['styleGuide']
      let forceLocal = false
      for (let index = 0; index < count; index += 1) {
        const slide = slides?.[index]
        const usesSample = Boolean(referencePayload) && (!slide || slide.role === 'cover')
        const request: MediaRequest = slide
          ? {
            prompt: carouselSlidePrompt({ ...promptParts, hasReference: usesSample, hasStyleGuide: Boolean(styleGuide) }, slide),
            apiKey,
            brand: { ...mediaBrand, headline: slide.headline },
            reference: usesSample ? referencePayload : undefined,
            aspect,
            slide,
            styleGuide,
            composed,
            forceLocal,
            openaiOff,
          }
          : {
            prompt: marketingImagePrompt({ ...promptParts, hasReference: Boolean(reference), aspect }),
            apiKey,
            brand: mediaBrand,
            reference: referencePayload,
            aspect,
            composed,
            openaiOff,
          }
        const generated = await deps.media.generateImage(request)
        if (generated.notice) imageNotices.add(generated.notice)
        if (slide && index === 0 && !generated.fallback) styleGuide = { bytes: generated.bytes, mimeType: generated.mimeType }
        if (slide && generated.fallback) forceLocal = true
        const storageKey = await deps.storage.put(generated.bytes, 'png')
        const asset = await deps.prisma.mediaAsset.create({
          data: {
            organizationId: post.organizationId,
            kind: 'generated_image',
            storageKey,
            mimeType: generated.mimeType,
            filename: `${post.format}-${index + 1}.png`,
          },
        })
        await deps.prisma.postMedia.create({
          data: { postId: post.id, mediaAssetId: asset.id, position: index },
        })
        await deps.prisma.aiUsage.create({
          data: { organizationId: post.organizationId, kind: 'image', tokens: 0 },
        })
      }
    }
    if (composed) {
      const explanation = [...imageNotices, copyError].filter(Boolean).join(' ') || null
      await deps.prisma.generationJob.update({ where: { id: job.id }, data: { status: 'ready', error: explanation } })
      return copyError
    }
    const imageNote = [...imageNotices].join(' ') || null
    await deps.prisma.generationJob.update({ where: { id: job.id }, data: { status: 'ready', error: imageNote } })
    if (post.generateCaption === false) return undefined
    try {
      await generateCopyForPost(deps, acting, post.id)
      return undefined
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Copy could not be written'
      await deps.prisma.generationJob.update({ where: { id: job.id }, data: { error: message } })
      return message
    }
  } catch (error) {
    const message = readableFailure(error, job.kind === 'video' || isVideoFormat(post.format) ? 'video' : 'image')
    await deps.prisma.generationJob.update({ where: { id: job.id }, data: { status: 'failed', error: message } })
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'generation_failed', message)
  }
}

export function readableFailure(error: unknown, kind: 'video' | 'image'): string {
  if (error instanceof ApiError) return error.message
  const raw = error instanceof Error ? error.message.replace(/\s+/g, ' ').trim() : ''
  if (/ENOENT/.test(raw) && /ffmpeg|ffprobe/.test(raw)) return `The ${kind} could not be rendered because ffmpeg is not installed on the server.`
  if (!raw) return `The ${kind} could not be generated. Try again.`
  return `The ${kind} could not be generated: ${raw.length > 160 ? `${raw.slice(0, 159)}…` : raw}`
}

const STALE_MS = 2 * 60 * 1000

export async function publishPost(deps: Deps, postId: string): Promise<void> {
  const post = await deps.prisma.post.findUnique({
    where: { id: postId },
    include: {
      media: { include: { asset: true }, orderBy: { position: 'asc' } },
      organization: true,
      targets: { include: { account: { include: { credential: true } } } },
    },
  })
  if (!post) throw new ApiError(404, 'not_found', 'Post not found')
  if (post.targets.length > 0) {
    await publishTargets(deps, post)
    return
  }
  if (post.igMediaId || post.status === 'PUBLISHED') {
    if (post.igMediaId && post.status !== 'PUBLISHED') {
      await markPublished(deps, post.id, post.organizationId, post.igMediaId)
    } else {
      await sendFirstCommentIfReady(deps, post.id)
    }
    return
  }
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: post.organizationId },
    include: { package: true },
  })
  const fail = async (code: string, message: string, status: 'FAILED' | 'PUBLISHING' = 'FAILED'): Promise<never> => {
    await deps.prisma.post.update({
      where: { id: post.id },
      data: { status, publishError: code === 'reconnect_required' ? 'reconnect_required' : message },
    })
    throw new ApiError(code === 'validation' ? 400 : 409, code, message)
  }
  if (!subscription || post.organization.suspended || (subscription.status !== 'trialing' && subscription.status !== 'active')) {
    await fail('subscription_inactive', 'This subscription cannot start a new publish')
  }
  if (!post.approvedAt) await fail('approval_required', 'A person has to approve this post before it can publish')
  if (claimsBlockPublish(parseClaims(post.factualClaims))) {
    await fail('claims_need_review', 'A factual claim still needs a person to accept it')
  }
  if (!post.media.length) await fail('validation', 'Add a photo or video before publishing')
  if (!post.instagramAccountId) await fail('reconnect_required', 'Reconnect the Instagram account before continuing')
  const instagramAccountId = post.instagramAccountId as string
  if (post.igContainerId) {
    try {
      const account = await usableToken(deps, post.organizationId, instagramAccountId)
      const existing = await deps.meta.findMediaByContainer(account.token, post.igContainerId)
      if (existing) {
        await markPublished(deps, post.id, post.organizationId, existing)
        return
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'reconnect_required') {
        await fail('reconnect_required', error.message)
      }
      throw error
    }
  }
  if (post.status !== 'PUBLISHING') {
    const claim = await deps.prisma.post.updateMany({
      where: { id: post.id, igMediaId: null, status: { in: ['PENDING_APPROVAL', 'SCHEDULED', 'FAILED'] } },
      data: { status: 'PUBLISHING', publishError: null },
    })
    if (claim.count === 0) return
  }
  let account: Awaited<ReturnType<typeof usableToken>>
  try {
    account = await usableToken(deps, post.organizationId, instagramAccountId)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'reconnect_required') {
      await deps.prisma.post.update({
        where: { id: post.id },
        data: { status: 'FAILED', publishError: 'reconnect_required', igContainerId: post.igContainerId },
      })
    }
    throw error
  }
  const caption = composePublishCaption(post.caption, parseHashtags(post.hashtags))
  let containerId = post.igContainerId
  if (!containerId) {
    const format = post.format === 'reel' ? 'reel' : post.format === 'video' ? 'video' : post.format === 'carousel' ? 'carousel' : post.format === 'story' ? 'story' : 'photo'
    containerId = await deps.meta.createMediaContainer({
      igUserId: account.igUserId,
      accessToken: account.token,
      format,
      caption,
      mediaUrls: post.media.map((item) => deps.storage.url(item.asset.storageKey)),
    })
    await deps.prisma.post.update({ where: { id: post.id }, data: { igContainerId: containerId } })
  }
  const status = await deps.meta.getContainerStatus(account.token, containerId)
  if (status === 'IN_PROGRESS') return
  if (status === 'ERROR') await fail('publish_failed', 'Instagram could not process the media')
  const current = await deps.prisma.post.findUnique({ where: { id: post.id } })
  if (!current || current.igMediaId) return
  const lock = await deps.prisma.post.updateMany({
    where: { id: post.id, igMediaId: null, igContainerId: containerId, publishAttempts: current.publishAttempts },
    data: { publishAttempts: { increment: 1 } },
  })
  if (lock.count === 0) return
  const again = await deps.meta.findMediaByContainer(account.token, containerId)
  const mediaId = again ?? (await deps.meta.publishContainer(account.token, account.igUserId, containerId))
  await markPublished(deps, post.id, post.organizationId, mediaId)
}

async function markPublished(deps: Deps, postId: string, organizationId: string, mediaId: string): Promise<void> {
  await deps.prisma.post.update({
    where: { id: postId },
    data: { status: 'PUBLISHED', igMediaId: mediaId, publishedAt: new Date(), publishError: null },
  })
  await audit(deps.prisma, {
    organizationId,
    actorType: 'system',
    action: 'post.published',
    targetType: 'post',
    targetId: postId,
    metadata: { igMediaId: mediaId },
  })
  await sendFirstCommentIfReady(deps, postId)
}

export async function sendFirstCommentIfReady(deps: Deps, postId: string): Promise<void> {
  const post = await deps.prisma.post.findUnique({ where: { id: postId } })
  const text = post?.firstComment.trim() ?? ''
  if (!post || !post.approvedAt || !post.igMediaId || !post.instagramAccountId || !text || post.firstCommentIgId) return
  try {
    const account = await usableToken(deps, post.organizationId, post.instagramAccountId)
    const sent = await deps.meta.commentOnMedia(account.token, post.igMediaId, text)
    await deps.prisma.post.update({
      where: { id: post.id },
      data: { firstCommentIgId: sent.id, firstCommentError: null },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram could not post the first comment'
    await deps.prisma.post.update({
      where: { id: post.id },
      data: { firstCommentError: message },
    })
  }
}

export async function sweepDuePosts(deps: Deps, now = new Date()): Promise<void> {
  const posts = await deps.prisma.post.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED', scheduledAt: { lte: now } },
        { status: 'PUBLISHING', igContainerId: { not: null } },
        { status: 'PUBLISHING', igContainerId: null, updatedAt: { lt: new Date(now.getTime() - STALE_MS) } },
      ],
    },
  })
  for (const post of posts) {
    try {
      await publishPost(deps, post.id)
    } catch (error) {
      deps.logger.warn({ err: error, postId: post.id }, 'scheduled publish failed')
    }
  }
}

export function keptHashtags(chips: HashtagChip[]): HashtagChip[] {
  return parseHashtags(chips).slice(0, 10)
}
