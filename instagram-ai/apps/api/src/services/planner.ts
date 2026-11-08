import {
  SYSTEM_PROMPT,
  buildPlanSlots,
  claimsBlockPublish,
  findForbiddenIntents,
  normalizeHashtags,
  roleHas,
  storedAudienceHours,
  stripForbiddenLines,
  validatePlanDraft,
  zonedDay,
  type HashtagChip,
  type PlanInputs,
  type PostFormat,
} from '@instagram-ai/shared'
import type { ContentPlan, Prisma } from '@prisma/client'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { audit } from '../audit'
import { decryptString } from '../crypto'
import { hitLimit } from '../rate-limit'
import { OPENAI_OFF_NOTICE, readProviderEnabled } from '../settings'
import { enqueuePublish } from '../queues'
import { assertQuota, requireWritable, type CustomerContext } from './context'
import { checkedDuration, generateCopyForPost, keptHashtags, loadBrand, parseClaims, startMediaJob } from './content'
import { replaceTargets } from './social'

const PLAN_RATE_LIMIT = 12
const PLAN_RATE_WINDOW_MS = 60 * 60 * 1000
const COPY_BATCH = 4
const OPEN = ['DRAFT', 'PENDING_APPROVAL'] as const
const LOCKED = ['PUBLISHED', 'PUBLISHING'] as const

const planResponse = z.object({
  slots: z.array(z.object({
    index: z.coerce.number().int(),
    topic: z.string().optional().default(''),
    caption: z.string().optional().default(''),
    hashtags: z.array(z.string()).optional().default([]),
  })).default([]),
})

type SlotDraft = { topic: string; caption: string; hashtags: string[] }
type SlotInfo = { index: number; day: string; hour: number; scheduledAt: Date; format: PostFormat }

export function readPlanInputs(value: unknown): PlanInputs {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<PlanInputs>
  return {
    range: raw.range === 'day' || raw.range === 'month' ? raw.range : 'week',
    startDate: typeof raw.startDate === 'string' ? raw.startDate : '',
    postsPerDay: typeof raw.postsPerDay === 'number' ? raw.postsPerDay : 1,
    weekdays: Array.isArray(raw.weekdays) ? raw.weekdays.filter((day): day is number => typeof day === 'number') : [],
    formats: Array.isArray(raw.formats) ? raw.formats : [],
    socialAccountIds: Array.isArray(raw.socialAccountIds) ? raw.socialAccountIds.filter((id): id is string => typeof id === 'string') : [],
    goal: typeof raw.goal === 'string' ? raw.goal : '',
    topics: Array.isArray(raw.topics) ? raw.topics.filter((topic): topic is string => typeof topic === 'string') : [],
    promotions: typeof raw.promotions === 'string' ? raw.promotions : '',
    tone: typeof raw.tone === 'string' ? raw.tone : '',
    language: typeof raw.language === 'string' ? raw.language : '',
    useBestTimes: raw.useBestTimes === true,
    campaignId: typeof raw.campaignId === 'string' ? raw.campaignId : null,
  }
}

export async function planTimeZone(deps: Deps, ctx: CustomerContext): Promise<string> {
  const account = await deps.prisma.instagramAccount.findFirst({ where: { organizationId: ctx.organization.id, status: 'connected' } })
  return account?.timezone || ctx.organization.timezone || 'UTC'
}

async function audienceHours(deps: Deps, organizationId: string) {
  const snapshot = await deps.prisma.metricSnapshot.findFirst({
    where: { organizationId, metric: 'audience_online' },
    orderBy: { capturedAt: 'desc' },
  })
  return storedAudienceHours(snapshot?.dimensions)
}

function requireScheduling(ctx: CustomerContext): void {
  if (!ctx.settings.features.scheduling) throw new ApiError(403, 'feature_disabled', 'Scheduling is turned off for the whole site')
  if (!ctx.subscription.package.scheduling) throw new ApiError(403, 'entitlement', `${ctx.subscription.package.name} does not include scheduling`)
}

function throttle(ctx: CustomerContext): void {
  if (!hitLimit(`plan:${ctx.organization.id}`, PLAN_RATE_LIMIT, PLAN_RATE_WINDOW_MS)) {
    throw new ApiError(429, 'rate_limited', 'Too many plans were generated just now. Try again in a little while.')
  }
}

function localTime(date: Date, timeZone: string): { day: string; hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', weekday: 'short' }).formatToParts(date)
  return {
    day: zonedDay(date.toISOString(), timeZone),
    hour: Number(parts.find((part) => part.type === 'hour')?.value ?? '0'),
    weekday: parts.find((part) => part.type === 'weekday')?.value ?? '',
  }
}

function instructionsFor(inputs: PlanInputs): string {
  return [
    `Plan goal: ${inputs.goal}`,
    inputs.promotions ? `Promotions and dates: ${inputs.promotions}` : '',
  ].filter(Boolean).join('\n')
}

async function aiChoice(deps: Deps, ctx: CustomerContext) {
  const profile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: ctx.organization.id } })
  const custom = ctx.subscription.package.customAi && ctx.settings.features.customAi
  return {
    extra: custom ? profile?.extraInstructions ?? '' : '',
    apiKey: custom && profile?.providerKeyEnc ? decryptString(profile.providerKeyEnc, deps.env.TOKEN_ENCRYPTION_KEY) : undefined,
    model: custom && profile?.modelId ? profile.modelId : 'platform-default',
    ownKey: Boolean(custom && profile?.providerKeyEnc),
  }
}

export async function textNotice(deps: Deps, ctx: CustomerContext): Promise<string | null> {
  const choice = await aiChoice(deps, ctx)
  if (choice.ownKey) return null
  const enabled = await readProviderEnabled(deps.prisma)
  return enabled.openai ? null : `${OPENAI_OFF_NOTICE}, so the captions use the built-in copy.`
}

async function draftTopics(
  deps: Deps,
  ctx: CustomerContext,
  inputs: PlanInputs,
  slots: SlotInfo[],
  timeZone: string,
  avoidTopics: string[],
): Promise<Map<number, SlotDraft>> {
  const brand = await loadBrand(deps, ctx.organization.id, ctx.organization.name)
  const knowledge = await deps.prisma.aiKnowledge.findMany({ where: { organizationId: ctx.organization.id, approved: true } })
  const choice = await aiChoice(deps, ctx)
  const language = inputs.language || brand.preferredLanguage
  const instructions = [
    choice.extra,
    instructionsFor(inputs),
    'Plan one post per listed slot. Vary the topics, do not repeat a topic, and respect the posting format of each slot.',
    'Return JSON: {"slots":[{"index":0,"topic":"one line topic","caption":"short draft caption","hashtags":["tag"]}]} with exactly one entry per slot index.',
  ].filter(Boolean).join('\n')
  const blocked = findForbiddenIntents(instructions)
  if (blocked.length) {
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'ai.blocked_intent',
      targetType: 'plan',
      metadata: { intents: blocked },
    })
  }
  let raw: unknown
  try {
    raw = await deps.text.complete({
      kind: 'content_plan',
      system: SYSTEM_PROMPT,
      brand,
      instructions,
      approvedKnowledge: knowledge.map((item) => ({ title: item.title, body: item.body })),
      content: {
        language: language || undefined,
        tone: inputs.tone || undefined,
        plan: {
          goal: inputs.goal,
          topics: inputs.topics,
          promotions: inputs.promotions,
          avoidTopics: avoidTopics.length ? avoidTopics : undefined,
          slots: slots.map((slot) => ({
            index: slot.index,
            date: slot.day,
            weekday: localTime(slot.scheduledAt, timeZone).weekday,
            time: `${String(slot.hour).padStart(2, '0')}:00`,
            format: slot.format,
          })),
        },
      },
      model: choice.model,
      apiKey: choice.apiKey,
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message.replace(/\s+/g, ' ').slice(0, 160) : ''
    throw new ApiError(502, 'generation_failed', `The planner could not draft this plan${reason ? `: ${reason}` : ''}`)
  }
  await deps.prisma.aiUsage.create({ data: { organizationId: ctx.organization.id, kind: 'text', tokens: instructions.length } })
  const parsed = planResponse.safeParse(raw)
  const drafts = new Map<number, SlotDraft>()
  for (const item of parsed.success ? parsed.data.slots : []) {
    const topic = stripForbiddenLines(item.topic).replace(/\s+/g, ' ').trim()
    if (!topic) continue
    drafts.set(item.index, { topic: topic.slice(0, 300), caption: stripForbiddenLines(item.caption).slice(0, 2200), hashtags: item.hashtags })
  }
  slots.forEach((slot, position) => {
    if (drafts.has(slot.index)) return
    const seed = inputs.topics.length ? inputs.topics[position % inputs.topics.length] : inputs.goal
    drafts.set(slot.index, { topic: seed.slice(0, 300), caption: '', hashtags: [] })
  })
  return drafts
}

async function writeCopy(deps: Deps, ctx: CustomerContext, postId: string, draft: SlotDraft): Promise<boolean> {
  let failed = false
  try {
    await generateCopyForPost(deps, ctx, postId)
  } catch {
    failed = true
  }
  const post = await deps.prisma.post.findUnique({ where: { id: postId } })
  const needsFallback = failed || !post?.caption.trim()
  await deps.prisma.post.update({
    where: { id: postId },
    data: {
      status: 'PENDING_APPROVAL',
      approvedAt: null,
      approvedById: null,
      ...(needsFallback
        ? {
          caption: draft.caption || draft.topic,
          generatedCaption: draft.caption || draft.topic,
          hashtags: keptHashtags(normalizeHashtags(draft.hashtags)) as unknown as Prisma.InputJsonValue,
        }
        : {}),
    },
  })
  await deps.prisma.postTarget.updateMany({
    where: { postId, status: { notIn: ['PUBLISHED', 'CANCELED'] } },
    data: { status: 'PENDING_APPROVAL' },
  })
  return failed
}

async function writeAllCopy(deps: Deps, ctx: CustomerContext, items: Array<{ postId: string; draft: SlotDraft }>): Promise<number> {
  let failures = 0
  for (let start = 0; start < items.length; start += COPY_BATCH) {
    const batch = items.slice(start, start + COPY_BATCH)
    const results = await Promise.all(batch.map((item) => writeCopy(deps, ctx, item.postId, item.draft)))
    failures += results.filter(Boolean).length
  }
  return failures
}

export async function refreshPlanStatus(deps: Deps, planId: string): Promise<void> {
  const open = await deps.prisma.post.count({ where: { planId, status: { in: [...OPEN] } } })
  const total = await deps.prisma.post.count({ where: { planId } })
  await deps.prisma.contentPlan.update({ where: { id: planId }, data: { status: total === 0 ? 'empty' : open > 0 ? 'proposed' : 'approved' } })
}

export type CreatedPlan = { plan: ContentPlan; copyErrors: number; notice: string | null }

export async function createPlan(deps: Deps, ctx: CustomerContext, inputs: PlanInputs): Promise<CreatedPlan> {
  requireWritable(ctx)
  requireScheduling(ctx)
  const timeZone = await planTimeZone(deps, ctx)
  const audience = inputs.useBestTimes ? await audienceHours(deps, ctx.organization.id) : []
  const check = validatePlanDraft(inputs, { timeZone, audience })
  if (check.errors.length) throw new ApiError(400, 'validation', check.errors.join('. '))
  const slots = buildPlanSlots(inputs, { timeZone, audience })
  const accounts = await deps.prisma.socialAccount.findMany({
    where: { id: { in: inputs.socialAccountIds }, organizationId: ctx.organization.id, status: 'connected' },
  })
  if (accounts.length !== new Set(inputs.socialAccountIds).size) throw new ApiError(400, 'validation', 'Choose a connected account')
  if (inputs.campaignId) {
    const campaign = await deps.prisma.campaign.findFirst({ where: { id: inputs.campaignId, organizationId: ctx.organization.id } })
    if (!campaign) throw notFound('Campaign not found')
  }
  throttle(ctx)
  await assertQuota(deps, ctx, 'text', slots.length + 1)
  const drafts = await draftTopics(deps, ctx, inputs, slots, timeZone, [])
  const plan = await deps.prisma.contentPlan.create({
    data: {
      organizationId: ctx.organization.id,
      createdById: ctx.user.id,
      range: inputs.range,
      startsAt: slots[0].scheduledAt,
      endsAt: slots[slots.length - 1].scheduledAt,
      inputs: inputs as unknown as Prisma.InputJsonValue,
      campaignId: inputs.campaignId,
    },
  })
  const created: Array<{ postId: string; draft: SlotDraft }> = []
  for (const slot of slots) {
    const draft = drafts.get(slot.index) as SlotDraft
    const post = await deps.prisma.post.create({
      data: {
        organizationId: ctx.organization.id,
        planId: plan.id,
        status: 'PENDING_APPROVAL',
        format: slot.format,
        description: draft.topic,
        caption: draft.caption,
        generatedCaption: '',
        keywords: [],
        hashtags: [],
        alternativeCaptions: [],
        factualClaims: [],
        scheduledAt: slot.scheduledAt,
        durationSeconds: checkedDuration(slot.format, undefined),
        aiInstructions: instructionsFor(inputs),
        aiTone: inputs.tone,
        aiLanguage: inputs.language,
        generateCaption: false,
      },
    })
    const instagramAccountId = await replaceTargets(deps, ctx.organization.id, post.id, inputs.socialAccountIds)
    await deps.prisma.post.update({ where: { id: post.id }, data: { instagramAccountId } })
    await deps.prisma.postTarget.updateMany({ where: { postId: post.id }, data: { status: 'PENDING_APPROVAL' } })
    if (inputs.campaignId) {
      await deps.prisma.campaignPost.create({ data: { campaignId: inputs.campaignId, postId: post.id } })
    }
    created.push({ postId: post.id, draft })
  }
  const copyErrors = await writeAllCopy(deps, ctx, created)
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: 'user',
    actorId: ctx.user.id,
    action: 'plan.created',
    targetType: 'plan',
    targetId: plan.id,
    metadata: { range: inputs.range, posts: slots.length, copyErrors },
  })
  return { plan, copyErrors, notice: await textNotice(deps, ctx) }
}

export async function loadPlan(deps: Deps, ctx: CustomerContext, id: string): Promise<ContentPlan> {
  const plan = await deps.prisma.contentPlan.findFirst({ where: { id, organizationId: ctx.organization.id } })
  if (!plan) throw notFound('Plan not found')
  return plan
}

export async function planCounts(deps: Deps, planIds: string[]): Promise<Map<string, { total: number; pending: number; scheduled: number; published: number; failed: number }>> {
  const rows = planIds.length
    ? await deps.prisma.post.groupBy({ by: ['planId', 'status'], where: { planId: { in: planIds } }, _count: { _all: true } })
    : []
  const out = new Map<string, { total: number; pending: number; scheduled: number; published: number; failed: number }>()
  for (const id of planIds) out.set(id, { total: 0, pending: 0, scheduled: 0, published: 0, failed: 0 })
  for (const row of rows) {
    const entry = row.planId ? out.get(row.planId) : undefined
    if (!entry) continue
    const count = row._count._all
    entry.total += count
    if (row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL') entry.pending += count
    else if (row.status === 'SCHEDULED' || row.status === 'PUBLISHING') entry.scheduled += count
    else if (row.status === 'PUBLISHED') entry.published += count
    else if (row.status === 'FAILED') entry.failed += count
  }
  return out
}

export type MediaState = { state: 'ready' | 'generating' | 'failed' | 'none'; error: string | null }

export async function mediaStates(deps: Deps, posts: Array<{ id: string; media: unknown[] }>): Promise<Map<string, MediaState>> {
  const jobs = posts.length
    ? await deps.prisma.generationJob.findMany({ where: { postId: { in: posts.map((post) => post.id) } }, orderBy: { createdAt: 'desc' } })
    : []
  const latest = new Map<string, (typeof jobs)[number]>()
  for (const job of jobs) if (job.postId && !latest.has(job.postId)) latest.set(job.postId, job)
  const out = new Map<string, MediaState>()
  for (const post of posts) {
    const job = latest.get(post.id)
    if (job && (job.status === 'queued' || job.status === 'running')) out.set(post.id, { state: 'generating', error: null })
    else if (post.media.length) out.set(post.id, { state: 'ready', error: job?.status === 'ready' ? job.error : null })
    else if (job?.status === 'failed') out.set(post.id, { state: 'failed', error: job.error })
    else out.set(post.id, { state: 'none', error: null })
  }
  return out
}

async function loadPlanPost(deps: Deps, ctx: CustomerContext, planId: string, postId: string) {
  const post = await deps.prisma.post.findFirst({ where: { id: postId, planId, organizationId: ctx.organization.id } })
  if (!post) throw notFound('Post not found in this plan')
  return post
}

export type SlotEdit = {
  caption?: string
  description?: string
  hashtags?: HashtagChip[]
  scheduledAt?: string
  format?: PostFormat
  socialAccountIds?: string[]
}

export async function editPlanPost(deps: Deps, ctx: CustomerContext, planId: string, postId: string, edit: SlotEdit): Promise<void> {
  requireWritable(ctx)
  const plan = await loadPlan(deps, ctx, planId)
  const post = await loadPlanPost(deps, ctx, plan.id, postId)
  if ((LOCKED as readonly string[]).includes(post.status)) throw new ApiError(409, 'validation', 'A post that is publishing or published cannot be edited')
  let scheduledAt: Date | undefined
  if (edit.scheduledAt !== undefined) {
    scheduledAt = new Date(edit.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, 'validation', 'Choose a valid time')
    if (scheduledAt.getTime() <= Date.now()) throw new ApiError(400, 'validation', 'Choose a time in the future')
  }
  if (edit.hashtags && edit.hashtags.length > 10) throw new ApiError(400, 'validation', 'A post can keep at most 10 hashtags')
  const contentChanged = edit.caption !== undefined || edit.description !== undefined || edit.hashtags !== undefined || edit.format !== undefined || edit.socialAccountIds !== undefined
  if (edit.socialAccountIds) {
    if (!edit.socialAccountIds.length) throw new ApiError(400, 'validation', 'Choose at least one account to post to')
    const instagramAccountId = await replaceTargets(deps, ctx.organization.id, post.id, edit.socialAccountIds)
    await deps.prisma.post.update({ where: { id: post.id }, data: { instagramAccountId } })
  }
  const formatChanged = edit.format !== undefined && edit.format !== post.format
  if (formatChanged) await dropGeneratedMedia(deps, post.id)
  const keepApproval = !contentChanged && post.status === 'SCHEDULED'
  await deps.prisma.post.update({
    where: { id: post.id },
    data: {
      caption: edit.caption,
      description: edit.description,
      hashtags: edit.hashtags ? keptHashtags(edit.hashtags) as unknown as Prisma.InputJsonValue : undefined,
      format: edit.format,
      durationSeconds: formatChanged ? checkedDuration(edit.format as string, undefined) : undefined,
      scheduledAt,
      ...(keepApproval ? {} : { status: 'PENDING_APPROVAL', approvedAt: null, approvedById: null }),
    },
  })
  if (!keepApproval) {
    await deps.prisma.postTarget.updateMany({
      where: { postId: post.id, status: { notIn: ['PUBLISHED', 'CANCELED'] } },
      data: { status: 'PENDING_APPROVAL' },
    })
  } else if (scheduledAt) {
    await enqueuePublish(deps, post.id, scheduledAt.getTime() - Date.now())
  }
  await refreshPlanStatus(deps, plan.id)
  await audit(deps.prisma, {
    organizationId: ctx.organization.id,
    actorType: 'user',
    actorId: ctx.user.id,
    action: 'plan.post_edited',
    targetType: 'post',
    targetId: post.id,
    metadata: { planId: plan.id, fields: Object.keys(edit) },
  })
}

async function dropGeneratedMedia(deps: Deps, postId: string): Promise<void> {
  const linked = await deps.prisma.postMedia.findMany({ where: { postId }, include: { asset: true } })
  const stale = linked.filter((item) => item.asset.kind === 'generated_image' || item.asset.kind === 'generated_video').map((item) => item.id)
  if (stale.length) await deps.prisma.postMedia.deleteMany({ where: { id: { in: stale } } })
}

async function removePosts(deps: Deps, organizationId: string, postIds: string[]): Promise<void> {
  if (!postIds.length) return
  await deps.prisma.$transaction(async (tx) => {
    await tx.idea.updateMany({ where: { postId: { in: postIds }, organizationId }, data: { postId: null } })
    await tx.campaignPost.deleteMany({ where: { postId: { in: postIds } } })
    await tx.metricSnapshot.updateMany({ where: { postId: { in: postIds } }, data: { postId: null } })
    await tx.postTarget.deleteMany({ where: { postId: { in: postIds } } })
    await tx.postMedia.deleteMany({ where: { postId: { in: postIds } } })
    await tx.generationJob.deleteMany({ where: { postId: { in: postIds } } })
    await tx.draftFeedback.deleteMany({ where: { postId: { in: postIds } } })
    await tx.post.deleteMany({ where: { id: { in: postIds }, organizationId } })
  })
}

export async function deletePlanPost(deps: Deps, ctx: CustomerContext, planId: string, postId: string): Promise<void> {
  const plan = await loadPlan(deps, ctx, planId)
  const post = await loadPlanPost(deps, ctx, plan.id, postId)
  if ((LOCKED as readonly string[]).includes(post.status)) {
    throw new ApiError(409, 'validation', 'A published post stays on the record. Approval is still required before a post can publish.')
  }
  await removePosts(deps, ctx.organization.id, [post.id])
  await refreshPlanStatus(deps, plan.id)
  await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'plan.post_deleted', targetType: 'post', targetId: post.id, metadata: { planId: plan.id } })
}

export async function deletePlan(deps: Deps, ctx: CustomerContext, planId: string): Promise<{ deleted: number; kept: number }> {
  const plan = await loadPlan(deps, ctx, planId)
  const posts = await deps.prisma.post.findMany({ where: { planId: plan.id, organizationId: ctx.organization.id }, select: { id: true, status: true } })
  const removable = posts.filter((post) => !(LOCKED as readonly string[]).includes(post.status)).map((post) => post.id)
  const kept = posts.length - removable.length
  await removePosts(deps, ctx.organization.id, removable)
  if (kept) await deps.prisma.post.updateMany({ where: { planId: plan.id }, data: { planId: null } })
  await deps.prisma.contentPlan.delete({ where: { id: plan.id } })
  await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'plan.deleted', targetType: 'plan', targetId: plan.id, metadata: { deleted: removable.length, kept } })
  return { deleted: removable.length, kept }
}

export async function deletePlanPosts(deps: Deps, ctx: CustomerContext, planId: string, postIds: string[]): Promise<{ deleted: number; skipped: number }> {
  const plan = await loadPlan(deps, ctx, planId)
  const posts = await deps.prisma.post.findMany({ where: { id: { in: postIds }, planId: plan.id, organizationId: ctx.organization.id }, select: { id: true, status: true } })
  const removable = posts.filter((post) => !(LOCKED as readonly string[]).includes(post.status)).map((post) => post.id)
  await removePosts(deps, ctx.organization.id, removable)
  await refreshPlanStatus(deps, plan.id)
  await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'plan.posts_deleted', targetType: 'plan', targetId: plan.id, metadata: { postIds: removable } })
  return { deleted: removable.length, skipped: postIds.length - removable.length }
}

function slotFor(post: { scheduledAt: Date | null; format: string }, index: number, timeZone: string): SlotInfo {
  const at = post.scheduledAt ?? new Date()
  const local = localTime(at, timeZone)
  return { index, day: local.day, hour: local.hour, scheduledAt: at, format: post.format as PostFormat }
}

async function regenerate(deps: Deps, ctx: CustomerContext, plan: ContentPlan, postIds: string[] | null): Promise<{ regenerated: number; copyErrors: number; notice: string | null }> {
  requireWritable(ctx)
  const inputs = readPlanInputs(plan.inputs)
  const all = await deps.prisma.post.findMany({ where: { planId: plan.id, organizationId: ctx.organization.id }, orderBy: { scheduledAt: 'asc' } })
  const targets = all.filter((post) => (postIds ? postIds.includes(post.id) : (OPEN as readonly string[]).includes(post.status)) && !(LOCKED as readonly string[]).includes(post.status))
  if (!targets.length) throw new ApiError(409, 'validation', 'There is nothing left to regenerate')
  throttle(ctx)
  await assertQuota(deps, ctx, 'text', targets.length + 1)
  const timeZone = await planTimeZone(deps, ctx)
  const avoid = all.filter((post) => !targets.includes(post)).map((post) => post.description).filter(Boolean)
  const slots = targets.map((post, index) => slotFor(post, index, timeZone))
  const drafts = await draftTopics(deps, ctx, inputs, slots, timeZone, avoid)
  const items: Array<{ postId: string; draft: SlotDraft }> = []
  for (const [index, post] of targets.entries()) {
    const draft = drafts.get(index) as SlotDraft
    await dropGeneratedMedia(deps, post.id)
    await deps.prisma.post.update({ where: { id: post.id }, data: { description: draft.topic, status: 'PENDING_APPROVAL', approvedAt: null, approvedById: null } })
    items.push({ postId: post.id, draft })
  }
  const copyErrors = await writeAllCopy(deps, ctx, items)
  await refreshPlanStatus(deps, plan.id)
  await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: postIds ? 'plan.post_regenerated' : 'plan.regenerated', targetType: 'plan', targetId: plan.id, metadata: { posts: targets.length } })
  return { regenerated: targets.length, copyErrors, notice: await textNotice(deps, ctx) }
}

export async function regeneratePlanPost(deps: Deps, ctx: CustomerContext, planId: string, postId: string) {
  const plan = await loadPlan(deps, ctx, planId)
  await loadPlanPost(deps, ctx, plan.id, postId)
  return regenerate(deps, ctx, plan, [postId])
}

export async function regenerateWholePlan(deps: Deps, ctx: CustomerContext, planId: string) {
  const plan = await loadPlan(deps, ctx, planId)
  return regenerate(deps, ctx, plan, null)
}

export type SkippedPost = { id: string; reason: string }

export async function approvePlan(
  deps: Deps,
  ctx: CustomerContext,
  planId: string,
  postIds: string[] | undefined,
): Promise<{ approved: string[]; skipped: SkippedPost[]; mediaQueued: number }> {
  requireWritable(ctx)
  requireScheduling(ctx)
  const plan = await loadPlan(deps, ctx, planId)
  const posts = await deps.prisma.post.findMany({
    where: { planId: plan.id, organizationId: ctx.organization.id, ...(postIds ? { id: { in: postIds } } : {}) },
    include: { targets: true, media: true },
    orderBy: { scheduledAt: 'asc' },
  })
  const now = Date.now()
  const approved: string[] = []
  const skipped: SkippedPost[] = []
  for (const post of posts) {
    let reason = ''
    if (!(OPEN as readonly string[]).includes(post.status)) reason = post.status === 'SCHEDULED' ? 'Already approved' : 'This post can no longer be approved'
    else if (!post.caption.trim()) reason = 'Write a caption first'
    else if (claimsBlockPublish(parseClaims(post.factualClaims))) reason = 'A factual claim still needs a person to accept it'
    else if (!post.targets.length) reason = 'Choose an account to post to'
    else if (!post.scheduledAt || post.scheduledAt.getTime() <= now) reason = 'The scheduled time has passed. Move it to a later time'
    if (reason) {
      skipped.push({ id: post.id, reason })
      continue
    }
    const claim = await deps.prisma.post.updateMany({
      where: { id: post.id, status: { in: [...OPEN] } },
      data: { status: 'SCHEDULED', approvedAt: new Date(), approvedById: ctx.user.id, publishError: null },
    })
    if (claim.count === 0) continue
    await deps.prisma.postTarget.updateMany({ where: { postId: post.id, status: { notIn: ['PUBLISHED', 'FAILED', 'CANCELED'] } }, data: { status: 'SCHEDULED' } })
    await enqueuePublish(deps, post.id, (post.scheduledAt as Date).getTime() - now)
    approved.push(post.id)
  }
  if (postIds) {
    const found = new Set(posts.map((post) => post.id))
    for (const id of postIds) if (!found.has(id)) skipped.push({ id, reason: 'Not part of this plan' })
  }
  await refreshPlanStatus(deps, plan.id)
  if (approved.length) {
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'plan.approved', targetType: 'plan', targetId: plan.id, metadata: { postIds: approved, skipped: skipped.length } })
  }
  const needMedia = posts.filter((post) => approved.includes(post.id) && post.media.length === 0).map((post) => post.id)
  const mediaQueued = roleHas(ctx.membership.role, 'ai.generateMedia') ? needMedia.length : 0
  if (mediaQueued) {
    const run = async () => {
      for (const id of needMedia) {
        try {
          await startMediaJob(deps, ctx, id)
        } catch (error) {
          deps.logger.warn({ err: error, postId: id }, 'plan media generation failed')
        }
      }
    }
    if (deps.inlineJobs) await run()
    else void run()
  }
  return { approved, skipped, mediaQueued }
}
