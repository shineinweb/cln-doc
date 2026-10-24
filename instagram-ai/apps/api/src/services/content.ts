import {
  SYSTEM_PROMPT,
  claimsBlockPublish,
  composePublishCaption,
  findForbiddenIntents,
  normalizeHashtags,
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
import { audit } from '../audit'
import type { BrandContext } from '../providers/text'
import { assertQuota, asStringArray, requireWritable, type CustomerContext } from './context'
import { usableToken } from './instagram'

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
  const kind = format === 'reel' ? 'video' : format === 'carousel' ? 'carousel' : 'photo'
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
  const instructions = custom ? profile?.extraInstructions ?? '' : ''
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
  let apiKey = deps.env.TEXT_PROVIDER_KEY || undefined
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
    apiKey: deps.env.TEXT_PROVIDER_KEY || undefined,
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

export async function startMediaJob(
  deps: Deps,
  ctx: CustomerContext,
  postId: string,
  referenceAssetId?: string | null,
  carouselCount = 3,
): Promise<{ jobId: string; copyError?: string }> {
  requireWritable(ctx)
  const post = await deps.prisma.post.findFirst({ where: { id: postId, organizationId: ctx.organization.id } })
  if (!post) throw new ApiError(404, 'not_found', 'Post not found')
  const reference = await referenceFor(deps, ctx.organization.id, referenceAssetId ?? post.referenceAssetId)
  const video = post.format === 'reel'
  if (video && !ctx.settings.features.videoGeneration) {
    throw new ApiError(403, 'feature_disabled', 'Video generation is turned off for the whole site')
  }
  if (video && !ctx.subscription.package.videoGeneration) {
    throw new ApiError(403, 'entitlement', `${ctx.subscription.package.name} does not include video generation`)
  }
  const count = video ? 1 : post.format === 'carousel' ? Math.min(Math.max(carouselCount, 2), 10) : 1
  await assertQuota(deps, ctx, video ? 'video' : 'image', count)
  if (reference) {
    await deps.prisma.post.update({ where: { id: post.id }, data: { referenceAssetId: reference.id } })
  }
  const job = await deps.prisma.generationJob.create({
    data: { organizationId: ctx.organization.id, postId: post.id, kind: video ? 'video' : 'image', status: 'queued' },
  })
  if (video && !deps.inlineJobs) {
    const { enqueueVideo } = await import('../queues')
    await enqueueVideo(deps, job.id)
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
    if (job.kind === 'video' && !settings.features.videoGeneration) {
      throw new ApiError(403, 'feature_disabled', 'Video generation is turned off for the whole site')
    }
    if (job.kind === 'video' && !subscription.package.videoGeneration) {
      throw new ApiError(403, 'entitlement', `${subscription.package.name} does not include video generation`)
    }
    const count = job.kind === 'video' ? 1 : post.format === 'carousel' ? 3 : 1
    await assertQuota(deps, acting, job.kind === 'video' ? 'video' : 'image', count)
    const category = post.categoryId
      ? await deps.prisma.contentCategory.findFirst({ where: { id: post.categoryId, organizationId: post.organizationId } })
      : null
    const brand = await loadBrand(deps, post.organizationId, organization.name)
    const reference = await referenceFor(deps, post.organizationId, post.referenceAssetId)
    const profile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: post.organizationId } })
    const custom = subscription.package.customAi && settings.features.customAi
    let apiKey = deps.env.MEDIA_PROVIDER_KEY || undefined
    if (custom && profile?.providerKeyEnc) apiKey = decryptString(profile.providerKeyEnc, deps.env.TOKEN_ENCRYPTION_KEY)
    const prompt = [
      `Brand ${brand.brandName}.`,
      category ? `Category ${category.name}. ${category.styleNotes}` : '',
      post.description,
      brand.voiceAndTone ? `Tone ${brand.voiceAndTone}.` : '',
      brand.topicsToAvoid ? `Avoid ${brand.topicsToAvoid}.` : '',
      reference ? `Use the uploaded reference photo ${reference.filename} from this organization.` : 'Do not invent a real person.',
      'Do not invent a real person’s likeness from a name.',
    ].filter(Boolean).join(' ')
    const existing = await deps.prisma.postMedia.count({ where: { postId: post.id } })
    for (let index = 0; index < count; index += 1) {
      const generated = job.kind === 'video' ? await deps.media.generateVideo({ prompt, apiKey }) : await deps.media.generateImage({ prompt, apiKey })
      const extension = generated.mimeType === 'video/mp4' ? 'mp4' : 'png'
      const storageKey = await deps.storage.put(generated.bytes, extension)
      const asset = await deps.prisma.mediaAsset.create({
        data: {
          organizationId: post.organizationId,
          kind: job.kind === 'video' ? 'generated_video' : 'generated_image',
          storageKey,
          mimeType: generated.mimeType,
          filename: `${post.format}-${index + 1}.${extension}`,
        },
      })
      await deps.prisma.postMedia.create({
        data: { postId: post.id, mediaAssetId: asset.id, position: existing + index },
      })
      await deps.prisma.aiUsage.create({
        data: { organizationId: post.organizationId, kind: job.kind === 'video' ? 'video' : 'image', tokens: 0 },
      })
    }
    await deps.prisma.generationJob.update({ where: { id: job.id }, data: { status: 'ready' } })
    try {
      await generateCopyForPost(deps, acting, post.id)
      return undefined
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Copy could not be written'
      await deps.prisma.generationJob.update({ where: { id: job.id }, data: { error: message } })
      return message
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed'
    await deps.prisma.generationJob.update({ where: { id: job.id }, data: { status: 'failed', error: message } })
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'generation_failed', message)
  }
}

const STALE_MS = 2 * 60 * 1000

export async function publishPost(deps: Deps, postId: string): Promise<void> {
  const post = await deps.prisma.post.findUnique({
    where: { id: postId },
    include: { media: { include: { asset: true }, orderBy: { position: 'asc' } }, organization: true },
  })
  if (!post) throw new ApiError(404, 'not_found', 'Post not found')
  if (post.igMediaId || post.status === 'PUBLISHED') {
    if (post.igMediaId && post.status !== 'PUBLISHED') {
      await deps.prisma.post.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: post.publishedAt ?? new Date(), publishError: null },
      })
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
    const format = post.format === 'reel' ? 'reel' : post.format === 'carousel' ? 'carousel' : 'photo'
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
