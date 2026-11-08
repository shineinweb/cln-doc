import {
  HASHTAG_LIMIT,
  PLAN_RANGES,
  POST_FORMATS,
  SOCIAL_NETWORKS,
  claimsBlockPublish,
  firstCommentAvailable,
  formatMixCounts,
  isSocialNetwork,
  nextSevenDayWindow,
  normalizeHashtags,
  normalizeHexColor,
  normalizeKeywords,
  normalizeSmartLink,
  parseAdNetworks,
  parseHashtags,
  readAdNetworks,
  storedAudienceHours,
  type HashtagChip,
  type SocialNetwork,
} from '@instagram-ai/shared'
import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { encryptString, newSecret, sha256 } from '../crypto'
import { asyncRoute, browserOrigin } from '../http'
import { audit } from '../audit'
import { isDisplayableImage } from '../providers/media'
import { extensionFor, readUpload } from '../upload'
import {
  requireCustomer,
  requirePermission,
  requireWritable,
  seatLimitReached,
  type CustomerContext,
} from '../services/context'
import { loadSettings } from '../settings'
import {
  disconnectInstagram,
  finishInstagramConnect,
  presentAccount,
  startInstagramConnect,
  usableToken,
} from '../services/instagram'
import { checkedDuration, generateCopyForPost, generateIdea, keptHashtags, loadBrandKit, parseClaims, publishPost, startMediaJob } from '../services/content'
import { fetchReferenceImage } from '../services/reference-url'
import { disconnectSocial, finishSocialConnect, listSocialAccounts, replaceTargets, startSocialConnect } from '../services/social'
import { decisionFor, sendConversationMessage, suggestReply } from '../services/inbox'
import { deleteOrganization, insightsFor, storedReport, usageCounts } from '../services/platform'
import { attachCampaignPosts, campaignDashboard, loadCampaign, presentCampaign } from '../services/campaigns'
import {
  approvePlan,
  createPlan,
  deletePlan,
  deletePlanPost,
  deletePlanPosts,
  editPlanPost,
  loadPlan,
  mediaStates,
  planCounts,
  planTimeZone,
  readPlanInputs,
  regeneratePlanPost,
  regenerateWholePlan,
} from '../services/planner'
import { enqueuePublish } from '../queues'
import { pageArgs, pageBody, readPage, slicePage } from '../paging'
import { PostStatus } from '@prisma/client'

const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])

function presentTemplateValues(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const values = raw.values && typeof raw.values === 'object' && !Array.isArray(raw.values) ? (raw.values as Record<string, string>) : {}
  return {
    title: typeof raw.templateTitle === 'string' ? raw.templateTitle : '',
    values,
    faceUsed: typeof raw.faceAssetId === 'string',
    aiGenerated: raw.aiGenerated === true,
    aiNote: typeof raw.aiNote === 'string' ? raw.aiNote : '',
  }
}

async function authed(deps: Deps, req: Parameters<typeof requireCustomer>[1]) {
  return requireCustomer(deps, req)
}

export function presentPost(deps: Deps, post: {
  id: string
  status: string
  format: string
  categoryId: string | null
  description: string
  caption: string
  keywords: Prisma.JsonValue
  hashtags: Prisma.JsonValue
  creativeBrief: string | null
  callToAction: string | null
  alternativeCaptions: Prisma.JsonValue
  factualClaims: Prisma.JsonValue
  scheduledAt: Date | null
  publishedAt: Date | null
  igMediaId: string | null
  publishError: string | null
  approvedAt: Date | null
  instagramAccountId: string | null
  referenceAssetId: string | null
  durationSeconds?: number | null
  aiInstructions?: string
  generateCaption?: boolean
  aiLanguage?: string
  aiTone?: string
  commentKeyword?: string
  firstComment?: string
  firstCommentError?: string | null
  smartLinkUrl?: string | null
  smartLinkCode?: string | null
  smartLinkClicks?: number
  adNetworks?: Prisma.JsonValue | null
  templateId?: string | null
  templateValues?: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
  media?: Array<{ position: number; asset: { id: string; mimeType: string; storageKey: string; filename: string } }>
  targets?: Array<{
    id: string
    status: string
    remoteId: string | null
    error: string | null
    firstCommentRemoteId: string | null
    firstCommentError: string | null
    account: { id: string; network: string; displayName: string; username: string }
  }>
}) {
  const hashtags = parseHashtags(post.hashtags)
  return {
    id: post.id,
    status: post.status,
    format: post.format,
    categoryId: post.categoryId,
    description: post.description,
    caption: post.caption,
    keywords: Array.isArray(post.keywords) ? post.keywords.filter((item): item is string => typeof item === 'string') : [],
    hashtags,
    creativeBrief: post.creativeBrief,
    callToAction: post.callToAction,
    alternativeCaptions: Array.isArray(post.alternativeCaptions) ? post.alternativeCaptions : [],
    factualClaims: parseClaims(post.factualClaims),
    claimsNeedReview: claimsBlockPublish(parseClaims(post.factualClaims)),
    scheduledAt: post.scheduledAt,
    publishedAt: post.publishedAt,
    igMediaId: post.igMediaId,
    publishError: post.publishError,
    approvedAt: post.approvedAt,
    instagramAccountId: post.instagramAccountId,
    referenceAssetId: post.referenceAssetId,
    reference: null as null | { id: string; url: string; filename: string; mimeType: string },
    durationSeconds: post.durationSeconds ?? null,
    aiInstructions: post.aiInstructions ?? '',
    generateCaption: post.generateCaption !== false,
    aiLanguage: post.aiLanguage ?? '',
    aiTone: post.aiTone ?? '',
    commentKeyword: post.commentKeyword ?? '',
    firstComment: post.firstComment ?? '',
    firstCommentError: post.firstCommentError ?? null,
    smartLinkUrl: post.smartLinkUrl ?? null,
    smartLinkCode: post.smartLinkCode ?? null,
    smartLinkClicks: post.smartLinkClicks ?? 0,
    smartLinkPath: post.smartLinkCode ? `/api/l/${post.smartLinkCode}` : null,
    adNetworks: readAdNetworks(post.adNetworks),
    templateId: post.templateId ?? null,
    template: presentTemplateValues(post.templateValues),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    media: (post.media ?? []).map((item) => ({
      id: item.asset.id,
      url: deps.storage.url(item.asset.storageKey),
      mimeType: item.asset.mimeType,
      filename: item.asset.filename,
      position: item.position,
    })),
    socialAccountIds: (post.targets ?? []).map((target) => target.account.id),
    targets: (post.targets ?? []).map((target) => ({
      id: target.id,
      status: target.status,
      remoteId: target.remoteId,
      error: target.error,
      network: target.account.network,
      accountId: target.account.id,
      displayName: target.account.displayName,
      username: target.account.username,
      firstCommentAvailable: firstCommentAvailable(target.account.network),
      firstCommentRemoteId: target.firstCommentRemoteId,
      firstCommentError: target.firstCommentError,
    })),
  }
}

export const postInclude = {
  media: { include: { asset: true }, orderBy: { position: 'asc' as const } },
  targets: { include: { account: true }, orderBy: { createdAt: 'asc' as const } },
}

export async function presentPostWithReference(deps: Deps, post: Parameters<typeof presentPost>[1] & { organizationId?: string; referenceAssetId: string | null }) {
  const presented = presentPost(deps, post)
  if (!post.referenceAssetId) return presented
  const organizationId = post.organizationId
  const asset = organizationId
    ? await deps.prisma.mediaAsset.findFirst({ where: { id: post.referenceAssetId, organizationId } })
    : await deps.prisma.mediaAsset.findFirst({ where: { id: post.referenceAssetId } })
  if (!asset || asset.kind !== 'reference') return presented
  return {
    ...presented,
    reference: {
      id: asset.id,
      url: deps.storage.url(asset.storageKey),
      filename: asset.filename,
      mimeType: asset.mimeType,
    },
  }
}

function adNetworkValue(raw: SocialNetwork[] | undefined): Prisma.InputJsonValue | undefined {
  if (raw === undefined) return undefined
  const networks = parseAdNetworks(raw)
  if (!networks) throw new ApiError(400, 'validation', 'An ad label can only name Instagram, Facebook, TikTok, or YouTube')
  return networks
}

async function smartLinkFields(
  deps: Deps,
  currentCode: string | null,
  raw: string | null | undefined,
): Promise<{ smartLinkUrl?: string | null; smartLinkCode?: string }> {
  if (raw === undefined) return {}
  if (raw === null || raw.trim() === '') return { smartLinkUrl: null }
  const url = normalizeSmartLink(raw)
  if (!url) throw new ApiError(400, 'validation', 'A smart link has to be an http or https address')
  if (currentCode) return { smartLinkUrl: url, smartLinkCode: currentCode }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const smartLinkCode = randomBytes(9).toString('base64url')
    const taken = await deps.prisma.post.findUnique({ where: { smartLinkCode } })
    if (!taken) return { smartLinkUrl: url, smartLinkCode }
  }
  throw new ApiError(500, 'internal', 'Could not create a smart link')
}

function reportDay(value: string, end: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

export function customerRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/dashboard', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const failedWhere = { organizationId: ctx.organization.id, status: 'FAILED' as const }
    const week = nextSevenDayWindow()
    const [
      scheduledPosts,
      awaitingApproval,
      unansweredComments,
      errorTotal,
      errors,
      usage,
      weekPosts,
      recentAssets,
      recentPosts,
      formatPosts,
    ] = await Promise.all([
      deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'SCHEDULED' } }),
      deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'PENDING_APPROVAL' } }),
      deps.prisma.comment.count({ where: { organizationId: ctx.organization.id, replied: false, deleted: false, done: false } }),
      deps.prisma.post.count({ where: failedWhere }),
      deps.prisma.post.findMany({
        where: failedWhere,
        orderBy: { updatedAt: 'desc' },
        ...pageArgs(page),
        select: { id: true, publishError: true, updatedAt: true, status: true },
      }),
      usageCounts(deps, ctx.organization.id, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd),
      deps.prisma.post.findMany({
        where: {
          organizationId: ctx.organization.id,
          status: { in: ['SCHEDULED', 'PENDING_APPROVAL'] },
          scheduledAt: { gte: week.from, lte: week.to },
        },
        orderBy: { scheduledAt: 'asc' },
        include: postInclude,
      }),
      deps.prisma.mediaAsset.findMany({
        where: { organizationId: ctx.organization.id, kind: { notIn: ['logo', 'face'] } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      deps.prisma.post.findMany({
        where: { organizationId: ctx.organization.id },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        include: postInclude,
      }),
      deps.prisma.post.findMany({
        where: { organizationId: ctx.organization.id },
        select: { format: true },
      }),
    ])
    const pkg = ctx.subscription.package
    res.json({
      scheduledPosts,
      awaitingApproval,
      unansweredComments,
      aiQuota: { used: usage.text, limit: pkg.monthlyAiGenerations },
      credits: {
        text: { used: usage.text, limit: pkg.monthlyAiGenerations, remaining: Math.max(0, pkg.monthlyAiGenerations - usage.text) },
        image: { used: usage.image, limit: pkg.monthlyImageGenerations, remaining: Math.max(0, pkg.monthlyImageGenerations - usage.image) },
        video: { used: usage.video, limit: pkg.monthlyVideoGenerations, remaining: Math.max(0, pkg.monthlyVideoGenerations - usage.video) },
      },
      weekStrip: weekPosts.map((post) => presentPost(deps, post)),
      week: { from: week.from.toISOString(), to: week.to.toISOString() },
      recentGenerations: recentAssets.map((asset) => ({
        id: asset.id,
        url: deps.storage.url(asset.storageKey),
        mimeType: asset.mimeType,
        filename: asset.filename,
        kind: asset.kind,
        createdAt: asset.createdAt,
      })),
      recentPosts: recentPosts.map((post) => presentPost(deps, post)),
      charts: {
        formatMix: formatMixCounts(formatPosts.map((post) => post.format)),
      },
      publishingErrors: errors,
      ...pageBody(page, errorTotal),
    })
  }))

  router.get('/api/org', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    res.json({
      organization: ctx.organization,
      role: ctx.membership.role,
      package: ctx.subscription.package,
      subscription: {
        status: ctx.subscription.status,
        seats: ctx.subscription.seatsOverride ?? ctx.subscription.package.seats,
        currentPeriodEnd: ctx.subscription.currentPeriodEnd,
      },
      maintenanceMessage: ctx.settings.general.maintenanceMessage,
    })
  }))

  router.delete('/api/org', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'billing.manage')
    if (req.body?.confirm !== true) throw new ApiError(400, 'validation', 'Confirm organization deletion')
    await deleteOrganization(deps, ctx.organization.id, ctx.user.id)
    res.json({ ok: true })
  }))

  router.get('/api/members', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, members] = await Promise.all([
      deps.prisma.membership.count({ where }),
      deps.prisma.membership.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'asc' },
        ...pageArgs(page),
      }),
    ])
    res.json({
      members: members.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        disabled: member.user.disabled,
      })),
      ...pageBody(page, total),
    })
  }))

  router.patch('/api/members/:userId', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'members.manage')
    const body = z.object({ role: z.enum(['ADMIN', 'EDITOR', 'SUPPORT']) }).parse(req.body)
    const membership = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: ctx.organization.id, userId: req.params.userId } },
    })
    if (!membership) throw notFound()
    if (membership.role === 'OWNER') throw new ApiError(403, 'forbidden', 'The owner role stays with the owner')
    await deps.prisma.membership.update({ where: { id: membership.id }, data: { role: body.role } })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'membership.role_changed',
      targetId: membership.userId,
      metadata: { role: body.role },
    })
    res.json({ ok: true })
  }))

  router.delete('/api/members/:userId', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'members.manage')
    const membership = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: ctx.organization.id, userId: req.params.userId } },
    })
    if (!membership) throw notFound()
    if (membership.role === 'OWNER') throw new ApiError(403, 'forbidden', 'The owner cannot be removed')
    await deps.prisma.membership.delete({ where: { id: membership.id } })
    res.json({ ok: true })
  }))

  router.post('/api/invitations', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'members.manage')
    const body = z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'EDITOR', 'SUPPORT']) }).parse(req.body)
    if (await seatLimitReached(deps, ctx)) throw new ApiError(403, 'entitlement', 'The seat limit is already reached')
    const token = newSecret()
    const invitation = await deps.prisma.invitation.create({
      data: {
        organizationId: ctx.organization.id,
        email: body.email.toLowerCase(),
        role: body.role,
        tokenHash: sha256(token),
        invitedById: ctx.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'invitation.created',
      targetId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    })
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    deps.logger.info({ template: settings.email.inviteTemplate, invitationId: invitation.id }, 'invitation created')
    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      ...(deps.env.EXPOSE_DEV_TOKENS ? { token } : {}),
    })
  }))

  router.get('/api/billing', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const usage = await usageCounts(deps, ctx.organization.id, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd)
    res.json({
      package: ctx.subscription.package,
      status: ctx.subscription.status,
      seats: ctx.subscription.seatsOverride ?? ctx.subscription.package.seats,
      currentPeriodStart: ctx.subscription.currentPeriodStart,
      currentPeriodEnd: ctx.subscription.currentPeriodEnd,
      usage,
      devAssign: deps.env.BILLING_DEV_ASSIGN,
    })
  }))

  router.post('/api/billing/checkout', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'billing.manage')
    const body = z.object({ packageId: z.string() }).parse(req.body)
    const pkg = await deps.prisma.package.findUnique({ where: { id: body.packageId } })
    if (!pkg) throw notFound('Package not found')
    const session = await deps.payments.createCheckout({
      organizationId: ctx.organization.id,
      packageId: pkg.id,
      packageName: pkg.name,
      priceMinor: pkg.priceMinor,
      currency: pkg.currency,
      successUrl: `${deps.env.WEB_ORIGIN}/app/settings/billing?checkout=success`,
      cancelUrl: `${deps.env.WEB_ORIGIN}/app/settings/billing?checkout=cancel`,
      customerEmail: ctx.user.email,
    })
    res.json(session)
  }))

  router.post('/api/billing/portal', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'billing.manage')
    if (!ctx.subscription.providerCustomerId) {
      throw new ApiError(400, 'billing_unconfigured', 'This organization has no billing customer yet')
    }
    const portal = await deps.payments.createPortal({
      customerId: ctx.subscription.providerCustomerId,
      returnUrl: `${deps.env.WEB_ORIGIN}/app/settings/billing`,
    })
    res.json(portal)
  }))

  router.post('/api/billing/dev/assign', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'billing.manage')
    if (!deps.env.BILLING_DEV_ASSIGN) throw new ApiError(403, 'forbidden', 'Package assignment without payment is turned off')
    const body = z.object({ packageId: z.enum(['starter', 'growth', 'pro']) }).parse(req.body)
    const now = new Date()
    await deps.prisma.subscription.update({
      where: { organizationId: ctx.organization.id },
      data: {
        packageId: body.packageId,
        status: 'active',
        provider: 'dev',
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'subscription.dev_assigned',
      metadata: { packageId: body.packageId },
    })
    res.json({ ok: true, packageId: body.packageId })
  }))

  router.get('/api/brand', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const brand = await deps.prisma.brandProfile.findUnique({ where: { organizationId: ctx.organization.id } })
    res.json({ brand })
  }))

  router.put('/api/brand', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.use')
    const body = z.object({
      brandName: z.string().min(1).max(120),
      businessDescription: z.string().max(4000).default(''),
      targetAudience: z.string().max(2000).default(''),
      voiceAndTone: z.string().max(2000).default(''),
      productsAndServices: z.string().max(4000).default(''),
      approvedFacts: z.array(z.string().max(500)).max(100).default([]),
      topicsToAvoid: z.string().max(2000).default(''),
      preferredLanguage: z.string().max(20).default('en'),
    }).parse(req.body)
    const brand = await deps.prisma.brandProfile.upsert({
      where: { organizationId: ctx.organization.id },
      create: { organizationId: ctx.organization.id, ...body },
      update: body,
    })
    res.json({ brand })
  }))

  router.get('/api/brand-kit', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const kit = await loadBrandKit(deps, ctx.organization.id)
    res.json({ logoUrl: kit.logoUrl, primaryColor: kit.primaryColor, hashtags: kit.hashtags })
  }))

  router.put('/api/brand-kit', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      primaryColor: z.string().max(16).nullable().optional(),
      hashtags: z.array(z.string()).max(30).optional(),
    }).parse(req.body)
    const data: Prisma.OrganizationUpdateInput = {}
    if (body.primaryColor !== undefined) {
      if (body.primaryColor === null || body.primaryColor.trim() === '') data.brandPrimaryColor = null
      else {
        const color = normalizeHexColor(body.primaryColor)
        if (!color) throw new ApiError(400, 'validation', 'Use one primary color as #RRGGBB')
        data.brandPrimaryColor = color
      }
    }
    if (body.hashtags) {
      data.brandHashtags = normalizeHashtags(body.hashtags).map((chip) => chip.tag)
    }
    await deps.prisma.organization.update({ where: { id: ctx.organization.id }, data })
    const kit = await loadBrandKit(deps, ctx.organization.id)
    res.json({ logoUrl: kit.logoUrl, primaryColor: kit.primaryColor, hashtags: kit.hashtags })
  }))

  router.post('/api/brand-kit/logo', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const file = await readUpload(req)
    if (!IMAGE.has(file.mimeType) || !isDisplayableImage(file.buffer, file.mimeType)) {
      throw new ApiError(400, 'validation', 'Logo must be a PNG, JPEG, or WebP')
    }
    const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
    const asset = await deps.prisma.mediaAsset.create({
      data: { organizationId: ctx.organization.id, kind: 'logo', storageKey, mimeType: file.mimeType, filename: file.filename },
    })
    const current = await deps.prisma.organization.findUnique({ where: { id: ctx.organization.id } })
    const previous = current?.brandLogoAssetId
    await deps.prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { brandLogoAssetId: asset.id },
    })
    if (previous && previous !== asset.id) {
      const used = await deps.prisma.postMedia.count({ where: { mediaAssetId: previous } })
      if (!used) {
        const old = await deps.prisma.mediaAsset.findFirst({ where: { id: previous, organizationId: ctx.organization.id } })
        if (old) {
          await deps.prisma.mediaAsset.delete({ where: { id: old.id } })
          await deps.storage.remove(old.storageKey)
        }
      }
    }
    const kit = await loadBrandKit(deps, ctx.organization.id)
    res.status(201).json({ logoUrl: kit.logoUrl, primaryColor: kit.primaryColor, hashtags: kit.hashtags })
  }))

  router.delete('/api/brand-kit', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const current = await deps.prisma.organization.findUnique({ where: { id: ctx.organization.id } })
    const previous = current?.brandLogoAssetId
    await deps.prisma.organization.update({
      where: { id: ctx.organization.id },
      data: { brandPrimaryColor: null, brandHashtags: [], brandLogoAssetId: null },
    })
    if (previous) {
      const used = await deps.prisma.postMedia.count({ where: { mediaAssetId: previous } })
      if (!used) {
        const old = await deps.prisma.mediaAsset.findFirst({ where: { id: previous, organizationId: ctx.organization.id } })
        if (old) {
          await deps.prisma.mediaAsset.delete({ where: { id: old.id } })
          await deps.storage.remove(old.storageKey)
        }
      }
    }
    res.json({ logoUrl: null, primaryColor: null, hashtags: [] })
  }))

  router.get('/api/ai/profile', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const profile = await deps.prisma.aiProfile.findUnique({ where: { organizationId: ctx.organization.id } })
    const customizable = ctx.subscription.package.customAi && ctx.settings.features.customAi
    res.json({
      customizable,
      requiredPackage: 'Pro',
      modelId: profile?.modelId ?? 'platform-default',
      hasCustomerKey: Boolean(profile?.providerKeyEnc),
      instructions: customizable ? profile?.extraInstructions ?? '' : '',
      tone: customizable ? profile?.tone ?? '' : '',
      language: customizable ? profile?.language ?? '' : '',
      allowedModels: ctx.settings.ai.allowedModels[ctx.subscription.packageId as 'starter' | 'growth' | 'pro'] ?? ['platform-default'],
    })
  }))

  router.put('/api/ai/profile', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    if (!ctx.settings.features.customAi) throw new ApiError(403, 'feature_disabled', 'Custom AI is turned off for the whole site')
    if (!ctx.subscription.package.customAi) {
      throw new ApiError(403, 'entitlement', 'Custom AI is available on the Pro package')
    }
    const body = z.object({
      instructions: z.string().max(8000).optional(),
      modelId: z.string().optional(),
      providerKey: z.string().min(8).max(300).optional(),
      tone: z.string().max(500).optional(),
      language: z.string().max(500).optional(),
    }).parse(req.body)
    const allowed = ctx.settings.ai.allowedModels.pro
    if (body.modelId && !allowed.includes(body.modelId)) throw new ApiError(400, 'validation', 'That model is not available on this package')
    const data: Prisma.AiProfileUpdateInput = {}
    if (body.instructions !== undefined) data.extraInstructions = body.instructions
    if (body.modelId) data.modelId = body.modelId
    if (body.tone !== undefined) data.tone = body.tone
    if (body.language !== undefined) data.language = body.language
    if (body.providerKey) data.providerKeyEnc = encryptString(body.providerKey, deps.env.TOKEN_ENCRYPTION_KEY)
    const profile = await deps.prisma.aiProfile.upsert({
      where: { organizationId: ctx.organization.id },
      create: {
        organizationId: ctx.organization.id,
        extraInstructions: body.instructions ?? '',
        modelId: body.modelId ?? 'platform-default',
        tone: body.tone,
        language: body.language,
        providerKeyEnc: body.providerKey ? encryptString(body.providerKey, deps.env.TOKEN_ENCRYPTION_KEY) : null,
      },
      update: data,
    })
    res.json({ modelId: profile.modelId, hasCustomerKey: Boolean(profile.providerKeyEnc) })
  }))

  router.delete('/api/ai/profile/key', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    if (!ctx.subscription.package.customAi) throw new ApiError(403, 'entitlement', 'Custom AI is available on the Pro package')
    await deps.prisma.aiProfile.update({ where: { organizationId: ctx.organization.id }, data: { providerKeyEnc: null } })
    res.json({ hasCustomerKey: false })
  }))

  router.get('/api/ai/knowledge', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, knowledge] = await Promise.all([
      deps.prisma.aiKnowledge.count({ where }),
      deps.prisma.aiKnowledge.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ knowledge, ...pageBody(page, total) })
  }))

  router.post('/api/ai/knowledge', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    if (!ctx.subscription.package.customAi) throw new ApiError(403, 'entitlement', 'Custom AI is available on the Pro package')
    const body = z.object({ title: z.string().min(1).max(200), body: z.string().min(1).max(8000) }).parse(req.body)
    const row = await deps.prisma.aiKnowledge.create({
      data: { organizationId: ctx.organization.id, title: body.title, body: body.body, approved: false },
    })
    res.status(201).json({ knowledge: row })
  }))

  router.post('/api/ai/knowledge/:id/approve', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    const row = await deps.prisma.aiKnowledge.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!row) throw notFound()
    const knowledge = await deps.prisma.aiKnowledge.update({ where: { id: row.id }, data: { approved: true } })
    res.json({ knowledge })
  }))

  router.delete('/api/ai/knowledge/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    const row = await deps.prisma.aiKnowledge.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!row) throw notFound()
    await deps.prisma.aiKnowledge.delete({ where: { id: row.id } })
    res.json({ ok: true })
  }))

  router.patch('/api/ai/knowledge/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.customize')
    if (!ctx.subscription.package.customAi) throw new ApiError(403, 'entitlement', 'Custom AI is available on the Pro package')
    const row = await deps.prisma.aiKnowledge.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!row) throw notFound()
    const body = z.object({
      title: z.string().min(1).max(200).optional(),
      body: z.string().min(1).max(8000).optional(),
    }).parse(req.body)
    const knowledge = await deps.prisma.aiKnowledge.update({ where: { id: row.id }, data: body })
    res.json({ knowledge })
  }))

  router.post('/api/ai/drafts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.use')
    const body = z.object({
      kind: z.enum(['carousel_outline', 'reel_script', 'calendar_ideas']),
      brief: z.string().min(1).max(4000),
    }).parse(req.body)
    const draft = await generateIdea(deps, ctx, body.kind, body.brief)
    res.json({ draft })
  }))

  router.get('/api/categories', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, categories] = await Promise.all([
      deps.prisma.contentCategory.count({ where }),
      deps.prisma.contentCategory.findMany({ where, orderBy: { name: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ categories, ...pageBody(page, total) })
  }))

  router.post('/api/categories', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      name: z.string().min(1).max(80),
      styleNotes: z.string().max(2000).default(''),
      defaultFormat: z.enum(POST_FORMATS).default('photo'),
    }).parse(req.body)
    const category = await deps.prisma.contentCategory.create({ data: { organizationId: ctx.organization.id, ...body } })
    res.status(201).json({ category })
  }))

  router.patch('/api/categories/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const existing = await deps.prisma.contentCategory.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      styleNotes: z.string().max(2000).optional(),
      defaultFormat: z.enum(POST_FORMATS).optional(),
    }).parse(req.body)
    const category = await deps.prisma.contentCategory.update({ where: { id: existing.id }, data: body })
    res.json({ category })
  }))

  router.delete('/api/categories/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const existing = await deps.prisma.contentCategory.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    await deps.prisma.contentCategory.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  }))

  router.get('/api/integrations/instagram/connect', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'instagram.connect')
    requireWritable(ctx)
    const reconnectId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined
    const authorizeUrl = await startInstagramConnect(deps, ctx, reconnectId, browserOrigin(req, deps.env))
    res.json({ authorizeUrl })
  }))

  router.get('/api/integrations/instagram/callback', asyncRoute(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code || !state) throw new ApiError(400, 'validation', 'Instagram did not return a code')
    await finishInstagramConnect(deps, code, state)
    const next = '/app/settings/instagram?connected=1'
    const origin = browserOrigin(req, deps.env)
    if (origin) res.redirect(`${origin}${next}`)
    else if (!deps.env.META_APP_ID && code === 'demo') res.redirect(next)
    else res.redirect(`${deps.env.WEB_ORIGIN.replace(/\/$/, '')}${next}`)
  }))

  router.get('/api/instagram/accounts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, accounts] = await Promise.all([
      deps.prisma.instagramAccount.count({ where }),
      deps.prisma.instagramAccount.findMany({ where, orderBy: { username: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ accounts: accounts.map(presentAccount), ...pageBody(page, total) })
  }))

  router.delete('/api/instagram/accounts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'instagram.connect')
    await disconnectInstagram(deps, ctx.organization.id, req.params.id)
    res.json({ ok: true })
  }))

  router.get('/api/social/accounts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const paged = slicePage(await listSocialAccounts(deps, ctx.organization.id), page)
    res.json({ accounts: paged.items, page: paged.page, pageSize: paged.pageSize, total: paged.total })
  }))

  router.delete('/api/social/accounts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'instagram.connect')
    await disconnectSocial(deps, ctx.organization.id, req.params.id)
    res.json({ ok: true })
  }))

  router.get('/api/integrations/:network/connect', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'instagram.connect')
    requireWritable(ctx)
    if (!isSocialNetwork(req.params.network) || req.params.network === 'instagram') {
      throw new ApiError(404, 'not_found', 'Not found')
    }
    const reconnectId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined
    const authorizeUrl = await startSocialConnect(deps, ctx, req.params.network, reconnectId, browserOrigin(req, deps.env))
    res.json({ authorizeUrl })
  }))

  router.get('/api/integrations/:network/callback', asyncRoute(async (req, res) => {
    if (!isSocialNetwork(req.params.network) || req.params.network === 'instagram') {
      throw new ApiError(404, 'not_found', 'Not found')
    }
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code || !state) throw new ApiError(400, 'validation', 'The network did not return a code')
    await finishSocialConnect(deps, req.params.network, code, state)
    res.redirect(`${deps.env.WEB_ORIGIN}/app/settings/instagram?connected=1`)
  }))

  router.get('/api/posts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined
    const page = readPage(req.query)
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : ''
    const statuses = statusRaw
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is PostStatus => (Object.values(PostStatus) as string[]).includes(item))
    const where: Prisma.PostWhereInput = {
      organizationId: ctx.organization.id,
      ...(from || to ? { scheduledAt: { gte: from, lte: to } } : {}),
      ...(req.query.smartLink === '1' ? { smartLinkUrl: { not: null } } : {}),
      ...(req.query.unscheduled === '1' ? { scheduledAt: null, status: { notIn: ['PUBLISHED', 'CANCELED'] } } : {}),
      ...(statuses.length ? { status: { in: statuses } } : {}),
    }
    const account = await deps.prisma.instagramAccount.findFirst({ where: { organizationId: ctx.organization.id, status: 'connected' } })
    const timezone = account?.timezone ?? ctx.organization.timezone
    if (req.query.ad === '1') {
      const posts = await deps.prisma.post.findMany({ where, include: postInclude, orderBy: { updatedAt: 'desc' } })
      const matched = posts.filter((post) => readAdNetworks(post.adNetworks).length > 0)
      const paged = slicePage(matched, page)
      res.json({ posts: paged.items.map((post) => presentPost(deps, post)), timezone, page: paged.page, pageSize: paged.pageSize, total: paged.total })
      return
    }
    const [total, posts] = await Promise.all([
      deps.prisma.post.count({ where }),
      deps.prisma.post.findMany({ where, include: postInclude, orderBy: { updatedAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ posts: posts.map((post) => presentPost(deps, post)), timezone, ...pageBody(page, total) })
  }))

  router.post('/api/posts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      format: z.enum(POST_FORMATS).default('photo'),
      description: z.string().max(4000).default(''),
      caption: z.string().max(2200).default(''),
      categoryId: z.string().optional(),
      instagramAccountId: z.string().optional(),
      durationSeconds: z.number().int().optional(),
      aiInstructions: z.string().max(8000).optional(),
      generateCaption: z.boolean().optional(),
      aiLanguage: z.string().max(500).optional(),
      aiTone: z.string().max(500).optional(),
      commentKeyword: z.string().max(80).optional(),
      firstComment: z.string().max(2000).optional(),
      hashtags: z.array(z.string()).max(30).optional(),
      socialAccountIds: z.array(z.string()).max(12).optional(),
      smartLinkUrl: z.string().max(2000).nullable().optional(),
      adNetworks: z.array(z.enum(SOCIAL_NETWORKS)).max(4).optional(),
      campaignId: z.string().optional(),
    }).parse(req.body)
    if (body.categoryId) {
      const category = await deps.prisma.contentCategory.findFirst({ where: { id: body.categoryId, organizationId: ctx.organization.id } })
      if (!category) throw notFound('Category not found')
    }
    if (body.campaignId) {
      const campaign = await deps.prisma.campaign.findFirst({ where: { id: body.campaignId, organizationId: ctx.organization.id } })
      if (!campaign) throw notFound('Campaign not found')
    }
    const post = await deps.prisma.post.create({
      data: {
        organizationId: ctx.organization.id,
        format: body.format,
        description: body.description,
        caption: body.caption,
        generatedCaption: '',
        keywords: [],
        hashtags: body.hashtags ? keptHashtags(normalizeHashtags(body.hashtags)) as unknown as Prisma.InputJsonValue : [],
        alternativeCaptions: [],
        factualClaims: [],
        categoryId: body.categoryId,
        instagramAccountId: body.instagramAccountId,
        durationSeconds: checkedDuration(body.format, body.durationSeconds),
        aiInstructions: body.aiInstructions ?? '',
        generateCaption: body.generateCaption ?? true,
        aiLanguage: body.aiLanguage ?? '',
        aiTone: body.aiTone ?? '',
        commentKeyword: body.commentKeyword?.trim() ?? '',
        firstComment: body.firstComment ?? '',
        adNetworks: adNetworkValue(body.adNetworks) ?? [],
        ...(await smartLinkFields(deps, null, body.smartLinkUrl)),
      },
      include: postInclude,
    })
    if (body.campaignId) {
      await deps.prisma.campaignPost.create({ data: { campaignId: body.campaignId, postId: post.id } })
    }
    if (body.socialAccountIds) {
      const instagramAccountId = await replaceTargets(deps, ctx.organization.id, post.id, body.socialAccountIds)
      const updated = await deps.prisma.post.update({
        where: { id: post.id },
        data: { instagramAccountId },
        include: postInclude,
      })
      res.status(201).json({ post: presentPost(deps, updated) })
      return
    }
    res.status(201).json({ post: presentPost(deps, post) })
  }))

  router.get('/api/posts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const post = await loadPost(deps, ctx, req.params.id)
    const jobs = await deps.prisma.generationJob.findMany({ where: { postId: post.id }, orderBy: { createdAt: 'desc' }, take: 1 })
    res.json({ post: await presentPostWithReference(deps, post), job: jobs[0] ?? null })
  }))

  router.patch('/api/posts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const existing = await loadPost(deps, ctx, req.params.id)
    const body = z.object({
      caption: z.string().max(2200).optional(),
      description: z.string().max(4000).optional(),
      keywords: z.array(z.string()).max(20).optional(),
      hashtags: z.array(z.object({ tag: z.string(), enabled: z.boolean() })).max(HASHTAG_LIMIT).optional(),
      instagramAccountId: z.string().nullable().optional(),
      format: z.enum(POST_FORMATS).optional(),
      durationSeconds: z.number().int().nullable().optional(),
      aiInstructions: z.string().max(8000).optional(),
      generateCaption: z.boolean().optional(),
      aiLanguage: z.string().max(500).optional(),
      aiTone: z.string().max(500).optional(),
      commentKeyword: z.string().max(80).optional(),
      firstComment: z.string().max(2000).optional(),
      socialAccountIds: z.array(z.string()).max(12).optional(),
      smartLinkUrl: z.string().max(2000).nullable().optional(),
      adNetworks: z.array(z.enum(SOCIAL_NETWORKS)).max(4).optional(),
      campaignId: z.string().nullable().optional(),
    }).parse(req.body)
    if (body.hashtags && body.hashtags.length > HASHTAG_LIMIT) {
      throw new ApiError(400, 'validation', 'A post can keep at most 10 hashtags')
    }
    const hashtags = body.hashtags ? keptHashtags(body.hashtags as HashtagChip[]) : undefined
    if (body.hashtags && hashtags && hashtags.length !== body.hashtags.length) {
      throw new ApiError(400, 'validation', 'A post can keep at most 10 hashtags')
    }
    if (body.socialAccountIds && existing.status === 'PUBLISHED') {
      throw new ApiError(409, 'validation', 'A published post cannot change accounts')
    }
    const linkedInstagram = body.socialAccountIds
      ? await replaceTargets(deps, ctx.organization.id, existing.id, body.socialAccountIds)
      : undefined
    if (existing.status !== 'PUBLISHED') {
      await deps.prisma.postTarget.updateMany({
        where: { postId: existing.id, status: { not: 'PUBLISHED' } },
        data: { status: 'DRAFT' },
      })
    }
    const post = await deps.prisma.post.update({
      where: { id: existing.id },
      data: {
        caption: body.caption,
        description: body.description,
        keywords: body.keywords ? normalizeKeywords(body.keywords) : undefined,
        hashtags: hashtags as unknown as Prisma.InputJsonValue,
        instagramAccountId: linkedInstagram !== undefined
          ? linkedInstagram
          : body.instagramAccountId === undefined ? undefined : body.instagramAccountId,
        format: body.format,
        durationSeconds: body.format || body.durationSeconds !== undefined
          ? checkedDuration(body.format ?? existing.format, body.durationSeconds ?? existing.durationSeconds ?? undefined)
          : undefined,
        aiInstructions: body.aiInstructions,
        generateCaption: body.generateCaption,
        aiLanguage: body.aiLanguage,
        aiTone: body.aiTone,
        commentKeyword: body.commentKeyword === undefined ? undefined : body.commentKeyword.trim(),
        firstComment: body.firstComment,
        firstCommentError: body.firstComment === undefined ? undefined : null,
        adNetworks: adNetworkValue(body.adNetworks),
        ...(await smartLinkFields(deps, existing.smartLinkCode, body.smartLinkUrl)),
        approvedAt: null,
        approvedById: null,
        status: existing.status === 'PUBLISHED' ? existing.status : 'DRAFT',
      },
      include: postInclude,
    })
    if (body.caption && body.caption !== existing.generatedCaption) {
      await deps.prisma.draftFeedback.create({
        data: {
          organizationId: ctx.organization.id,
          postId: post.id,
          kind: 'edited',
          original: { caption: existing.generatedCaption },
          accepted: { caption: body.caption },
        },
      })
    }
    if (body.campaignId !== undefined) {
      if (body.campaignId === null) {
        await deps.prisma.campaignPost.deleteMany({ where: { postId: post.id } })
      } else {
        const campaign = await deps.prisma.campaign.findFirst({
          where: { id: body.campaignId, organizationId: ctx.organization.id },
        })
        if (!campaign) throw notFound('Campaign not found')
        await deps.prisma.campaignPost.createMany({
          data: [{ campaignId: body.campaignId, postId: post.id }],
          skipDuplicates: true,
        })
      }
    }
    res.json({ post: presentPost(deps, post) })
  }))

  router.post('/api/posts/:id/media', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const post = await loadPost(deps, ctx, req.params.id)
    const file = await readUpload(req)
    if (![...IMAGE, 'video/mp4'].includes(file.mimeType)) throw new ApiError(400, 'validation', 'Upload a PNG, JPEG, WebP, or MP4')
    const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
    const asset = await deps.prisma.mediaAsset.create({
      data: { organizationId: ctx.organization.id, kind: 'upload', storageKey, mimeType: file.mimeType, filename: file.filename },
    })
    const position = await deps.prisma.postMedia.count({ where: { postId: post.id } })
    await deps.prisma.postMedia.create({ data: { postId: post.id, mediaAssetId: asset.id, position } })
    let copyError: string | undefined
    try {
      await generateCopyForPost(deps, ctx, post.id)
    } catch (error) {
      copyError = error instanceof ApiError ? error.message : 'Copy could not be written'
    }
    const updated = await loadPost(deps, ctx, post.id)
    res.status(201).json({ post: presentPost(deps, updated), copyError })
  }))

  router.post('/api/media/reference', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.generateMedia')
    const file = await readUpload(req)
    if (!IMAGE.has(file.mimeType) || !isDisplayableImage(file.buffer, file.mimeType)) {
      throw new ApiError(400, 'validation', 'Sample / reference photos must be PNG, JPEG, or WebP')
    }
    const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
    const asset = await deps.prisma.mediaAsset.create({
      data: { organizationId: ctx.organization.id, kind: 'reference', storageKey, mimeType: file.mimeType, filename: file.filename },
    })
    res.status(201).json({ asset: { id: asset.id, url: deps.storage.url(asset.storageKey), filename: asset.filename } })
  }))

  router.post('/api/media/reference-url', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.generateMedia')
    const body = z.object({ url: z.string().min(1).max(2000) }).parse(req.body ?? {})
    const file = await fetchReferenceImage(body.url, deps.httpFetch)
    const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
    const asset = await deps.prisma.mediaAsset.create({
      data: { organizationId: ctx.organization.id, kind: 'reference', storageKey, mimeType: file.mimeType, filename: file.filename },
    })
    res.status(201).json({ asset: { id: asset.id, url: deps.storage.url(asset.storageKey), filename: asset.filename } })
  }))

  router.post('/api/posts/:id/generate', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.generateMedia')
    const body = z.object({
      referenceAssetId: z.string().nullish(),
      sampleUrl: z.string().max(2000).optional(),
    }).parse(req.body ?? {})
    let referenceAssetId = body.referenceAssetId
    if (!referenceAssetId && body.sampleUrl) {
      const file = await fetchReferenceImage(body.sampleUrl, deps.httpFetch)
      const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
      const asset = await deps.prisma.mediaAsset.create({
        data: { organizationId: ctx.organization.id, kind: 'reference', storageKey, mimeType: file.mimeType, filename: file.filename },
      })
      referenceAssetId = asset.id
    }
    const result = await startMediaJob(deps, ctx, req.params.id, referenceAssetId)
    const post = await loadPost(deps, ctx, req.params.id)
    const job = await deps.prisma.generationJob.findUnique({ where: { id: result.jobId } })
    res.status(202).json({ post: await presentPostWithReference(deps, post), job, copyError: result.copyError })
  }))

  router.post('/api/posts/:id/generate-copy', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.use')
    await loadPost(deps, ctx, req.params.id)
    const before = await usageCounts(deps, ctx.organization.id, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd)
    await generateCopyForPost(deps, ctx, req.params.id)
    const after = await usageCounts(deps, ctx.organization.id, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd)
    const post = await loadPost(deps, ctx, req.params.id)
    res.json({ post: presentPost(deps, post), textUsed: after.text - before.text, imageUsed: after.image - before.image, videoUsed: after.video - before.video })
  }))

  router.post('/api/posts/:id/apply-seo-set', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({ setId: z.string() }).parse(req.body)
    const post = await loadPost(deps, ctx, req.params.id)
    const set = await deps.prisma.seoSet.findUnique({ where: { id: body.setId } })
    if (!set) throw notFound('Keyword set not found')
    const tags = [
      ...parseHashtags(post.hashtags).filter((chip) => chip.enabled).map((chip) => chip.tag),
      ...(Array.isArray(set.hashtags) ? set.hashtags.filter((item): item is string => typeof item === 'string') : []),
    ]
    const keywords = [
      ...(Array.isArray(post.keywords) ? post.keywords.filter((item): item is string => typeof item === 'string') : []),
      ...(Array.isArray(set.keywords) ? set.keywords.filter((item): item is string => typeof item === 'string') : []),
    ]
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { hashtags: keptHashtags(tags.map((tag) => ({ tag, enabled: true }))) as unknown as Prisma.InputJsonValue, keywords: normalizeKeywords(keywords) },
      include: postInclude,
    })
    res.json({ post: presentPost(deps, updated) })
  }))

  router.post('/api/posts/:id/accept-claims', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.publish')
    const post = await loadPost(deps, ctx, req.params.id)
    const claims = parseClaims(post.factualClaims).map((claim) => ({ ...claim, accepted: true }))
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { factualClaims: claims as unknown as Prisma.InputJsonValue },
      include: postInclude,
    })
    await deps.prisma.draftFeedback.create({
      data: {
        organizationId: ctx.organization.id,
        postId: post.id,
        kind: 'accepted',
        original: post.factualClaims as Prisma.InputJsonValue,
        accepted: claims as unknown as Prisma.InputJsonValue,
      },
    })
    res.json({ post: presentPost(deps, updated) })
  }))

  router.post('/api/posts/:id/approve', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.publish')
    requireWritable(ctx)
    const post = await loadPost(deps, ctx, req.params.id)
    if (!post.media.length) throw new ApiError(409, 'approval_required', 'A preview has to exist before approval')
    await deps.prisma.postTarget.updateMany({
      where: { postId: post.id, status: { notIn: ['PUBLISHED', 'CANCELED'] } },
      data: { status: 'PENDING_APPROVAL', error: null },
    })
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { status: 'PENDING_APPROVAL', approvedAt: new Date(), approvedById: ctx.user.id, publishError: null },
      include: postInclude,
    })
    if (post.caption !== post.generatedCaption) {
      await deps.prisma.draftFeedback.create({
        data: {
          organizationId: ctx.organization.id,
          postId: post.id,
          kind: 'accepted',
          original: { caption: post.generatedCaption },
          accepted: { caption: post.caption },
        },
      })
    }
    res.json({ post: presentPost(deps, updated) })
  }))

  router.post('/api/posts/:id/schedule', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.schedule')
    requireWritable(ctx)
    if (!ctx.settings.features.scheduling) throw new ApiError(403, 'feature_disabled', 'Scheduling is turned off for the whole site')
    if (!ctx.subscription.package.scheduling) throw new ApiError(403, 'entitlement', `${ctx.subscription.package.name} does not include scheduling`)
    const body = z.object({ scheduledAt: z.string() }).parse(req.body)
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, 'validation', 'Choose a valid time')
    const post = await loadPost(deps, ctx, req.params.id)
    if (!post.approvedAt) throw new ApiError(409, 'approval_required', 'A person has to approve this post before it can be scheduled')
    await deps.prisma.postTarget.updateMany({
      where: { postId: post.id, status: { notIn: ['PUBLISHED', 'FAILED', 'CANCELED'] } },
      data: { status: 'SCHEDULED' },
    })
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { status: 'SCHEDULED', scheduledAt },
      include: postInclude,
    })
    await enqueuePublish(deps, post.id, scheduledAt.getTime() - Date.now())
    res.json({ post: presentPost(deps, updated) })
  }))

  router.post('/api/posts/:id/move', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    const body = z.object({ scheduledAt: z.string() }).parse(req.body)
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) throw new ApiError(400, 'validation', 'Choose a valid time')
    const post = await loadPost(deps, ctx, req.params.id)
    if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') {
      throw new ApiError(409, 'validation', 'A published post cannot be moved')
    }
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt },
      include: postInclude,
    })
    if (updated.status === 'SCHEDULED') await enqueuePublish(deps, post.id, scheduledAt.getTime() - Date.now())
    res.json({ post: presentPost(deps, updated) })
  }))

  router.post('/api/posts/:id/publish', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.publish')
    requireWritable(ctx)
    await loadPost(deps, ctx, req.params.id)
    try {
      await publishPost(deps, req.params.id)
    } catch (error) {
      const failed = await loadPost(deps, ctx, req.params.id).catch(() => null)
      if (error instanceof ApiError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message }, post: failed ? presentPost(deps, failed) : undefined })
        return
      }
      throw error
    }
    const post = await loadPost(deps, ctx, req.params.id)
    res.json({ post: presentPost(deps, post) })
  }))

  router.post('/api/posts/:id/cancel', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.schedule')
    const post = await loadPost(deps, ctx, req.params.id)
    if (post.status === 'PUBLISHED') throw new ApiError(409, 'validation', 'A published post cannot be canceled')
    await deps.prisma.postTarget.updateMany({
      where: { postId: post.id, status: { not: 'PUBLISHED' } },
      data: { status: 'CANCELED' },
    })
    const updated = await deps.prisma.post.update({ where: { id: post.id }, data: { status: 'CANCELED' }, include: postInclude })
    res.json({ post: presentPost(deps, updated) })
  }))

  router.delete('/api/posts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const post = await loadPost(deps, ctx, req.params.id)
    if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') {
      throw new ApiError(409, 'validation', 'A published post stays on the record. Approval is still required before a post can publish.')
    }
    await deps.prisma.$transaction(async (tx) => {
      await tx.idea.updateMany({ where: { postId: post.id, organizationId: ctx.organization.id }, data: { postId: null } })
      await tx.campaignPost.deleteMany({ where: { postId: post.id } })
      await tx.metricSnapshot.updateMany({ where: { postId: post.id }, data: { postId: null } })
      await tx.postTarget.deleteMany({ where: { postId: post.id } })
      await tx.postMedia.deleteMany({ where: { postId: post.id } })
      await tx.generationJob.deleteMany({ where: { postId: post.id } })
      await tx.draftFeedback.deleteMany({ where: { postId: post.id } })
      await tx.post.delete({ where: { id: post.id } })
    })
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'post.deleted', targetId: post.id })
    res.json({ ok: true })
  }))

  router.get('/api/library', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const [assetTotal, assets, draftTotal, drafts] = await Promise.all([
      deps.prisma.mediaAsset.count({ where: { organizationId: ctx.organization.id, kind: { notIn: ['logo', 'face'] } } }),
      deps.prisma.mediaAsset.findMany({
        where: { organizationId: ctx.organization.id, kind: { notIn: ['logo', 'face'] } },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(page),
        include: { postMedia: { select: { postId: true }, take: 1 } },
      }),
      deps.prisma.post.count({
        where: { organizationId: ctx.organization.id, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      }),
      deps.prisma.post.findMany({
        where: { organizationId: ctx.organization.id, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: postInclude,
      }),
    ])
    res.json({
      assets: assets.map((asset) => ({
        id: asset.id,
        url: deps.storage.url(asset.storageKey),
        mimeType: asset.mimeType,
        filename: asset.filename,
        kind: asset.kind,
        createdAt: asset.createdAt,
        postId: asset.postMedia[0]?.postId ?? null,
      })),
      drafts: drafts.map((post) => presentPost(deps, post)),
      draftTotal,
      ...pageBody(page, assetTotal),
    })
  }))

  router.delete('/api/library/media/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const asset = await deps.prisma.mediaAsset.findFirst({
      where: { id: req.params.id, organizationId: ctx.organization.id },
      include: { postMedia: true },
    })
    if (!asset) throw notFound()
    if (asset.kind === 'logo') throw new ApiError(409, 'validation', 'The brand logo is managed in Brand kit')
    await deps.prisma.$transaction(async (tx) => {
      await tx.postMedia.deleteMany({ where: { mediaAssetId: asset.id } })
      await tx.mediaAsset.delete({ where: { id: asset.id } })
    })
    await deps.storage.remove(asset.storageKey)
    await audit(deps.prisma, {
      organizationId: ctx.organization.id,
      actorType: 'user',
      actorId: ctx.user.id,
      action: 'media.deleted',
      targetId: asset.id,
    })
    res.json({ ok: true })
  }))

  router.get('/api/campaigns', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'insights.read')
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, campaigns] = await Promise.all([
      deps.prisma.campaign.count({ where }),
      deps.prisma.campaign.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...pageArgs(page),
        include: { posts: true },
      }),
    ])
    res.json({
      campaigns: campaigns.map((campaign) => presentCampaign(campaign)),
      ...pageBody(page, total),
    })
  }))

  router.post('/api/campaigns', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    const body = z.object({
      name: z.string().trim().min(1).max(120),
      startsAt: z.string(),
      endsAt: z.string(),
      postIds: z.array(z.string()).max(100).optional(),
    }).parse(req.body)
    const startsAt = new Date(body.startsAt)
    const endsAt = new Date(body.endsAt)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt > endsAt) {
      throw new ApiError(400, 'validation', 'Choose a valid date range')
    }
    const campaign = await deps.prisma.campaign.create({
      data: {
        organizationId: ctx.organization.id,
        name: body.name,
        startsAt,
        endsAt,
      },
      include: { posts: true },
    })
    if (body.postIds?.length) {
      const attached = await attachCampaignPosts(deps, ctx.organization.id, campaign.id, body.postIds)
      res.status(201).json({ campaign: presentCampaign(attached) })
      return
    }
    res.status(201).json({ campaign: presentCampaign(campaign) })
  }))

  router.get('/api/campaigns/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'insights.read')
    const dashboard = await campaignDashboard(deps, ctx.organization.id, req.params.id)
    res.json(dashboard)
  }))

  router.patch('/api/campaigns/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    await loadCampaign(deps, ctx.organization.id, req.params.id)
    const body = z.object({
      name: z.string().trim().min(1).max(120).optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    }).parse(req.body)
    const startsAt = body.startsAt ? new Date(body.startsAt) : undefined
    const endsAt = body.endsAt ? new Date(body.endsAt) : undefined
    if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime()))) {
      throw new ApiError(400, 'validation', 'Choose a valid date range')
    }
    const updated = await deps.prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
      },
      include: { posts: true },
    })
    if (updated.startsAt > updated.endsAt) throw new ApiError(400, 'validation', 'Choose a valid date range')
    res.json({ campaign: presentCampaign(updated) })
  }))

  router.delete('/api/campaigns/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    await loadCampaign(deps, ctx.organization.id, req.params.id)
    await deps.prisma.campaign.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }))

  router.post('/api/campaigns/:id/posts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requireWritable(ctx)
    const body = z.object({ postIds: z.array(z.string()).min(1).max(100) }).parse(req.body)
    const campaign = await attachCampaignPosts(deps, ctx.organization.id, req.params.id, body.postIds)
    res.json({ campaign: presentCampaign(campaign) })
  }))

  router.delete('/api/campaigns/:id/posts/:postId', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    await loadCampaign(deps, ctx.organization.id, req.params.id)
    await deps.prisma.campaignPost.deleteMany({
      where: { campaignId: req.params.id, postId: req.params.postId },
    })
    const campaign = await loadCampaign(deps, ctx.organization.id, req.params.id)
    res.json({ campaign: presentCampaign(campaign) })
  }))

  router.get('/api/seo-sets', asyncRoute(async (req, res) => {
    await authed(deps, req)
    const page = readPage(req.query)
    const [total, sets] = await Promise.all([
      deps.prisma.seoSet.count(),
      deps.prisma.seoSet.findMany({ orderBy: { name: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ sets, ...pageBody(page, total) })
  }))

  router.get('/api/comments', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    if (!ctx.subscription.package.commentInbox) throw new ApiError(403, 'entitlement', 'This package does not include the comment inbox')
    const state = req.query.state === 'done' ? true : req.query.state === 'open' ? false : undefined
    const page = readPage(req.query)
    const where = {
      organizationId: ctx.organization.id,
      ...(typeof req.query.accountId === 'string' ? { instagramAccountId: req.query.accountId } : {}),
      ...(typeof req.query.igMediaId === 'string' ? { igMediaId: req.query.igMediaId } : {}),
      ...(state === undefined ? {} : { done: state }),
    }
    const [total, comments] = await Promise.all([
      deps.prisma.comment.count({ where }),
      deps.prisma.comment.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ comments, ...pageBody(page, total) })
  }))

  router.post('/api/comments/:id/done', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    const body = z.object({ done: z.boolean() }).parse(req.body)
    const comment = await loadComment(deps, ctx, req.params.id)
    const updated = await deps.prisma.comment.update({ where: { id: comment.id }, data: { done: body.done } })
    res.json({ comment: updated })
  }))

  router.post('/api/comments/:id/suggest', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    if (!ctx.subscription.package.commentInbox) throw new ApiError(403, 'entitlement', 'This package does not include the comment inbox')
    const comment = await loadComment(deps, ctx, req.params.id)
    const text = await suggestReply(deps, ctx, 'comment_reply', comment.text)
    res.json({ text })
  }))

  router.post('/api/comments/:id/reply', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    requireWritable(ctx)
    if (!ctx.subscription.package.commentInbox) throw new ApiError(403, 'entitlement', 'This package does not include the comment inbox')
    const body = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)
    const comment = await loadComment(deps, ctx, req.params.id)
    const account = await usableToken(deps, ctx.organization.id, comment.instagramAccountId)
    const sent = await deps.meta.replyToComment(account.token, comment.igCommentId, body.text)
    const updated = await deps.prisma.comment.update({
      where: { id: comment.id },
      data: { replied: true, replyText: body.text, repliedAt: new Date() },
    })
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'comment.replied', targetId: comment.id, metadata: { igReplyId: sent.id } })
    res.json({ comment: updated })
  }))

  router.post('/api/comments/:id/assign', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    const body = z.object({ userId: z.string() }).parse(req.body)
    const comment = await loadComment(deps, ctx, req.params.id)
    const member = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: ctx.organization.id, userId: body.userId } },
    })
    if (!member) throw notFound('Teammate not found')
    const updated = await deps.prisma.comment.update({ where: { id: comment.id }, data: { assignedToId: body.userId } })
    res.json({ comment: updated })
  }))

  router.post('/api/comments/:id/hide', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.moderate')
    const comment = await loadComment(deps, ctx, req.params.id)
    const account = await usableToken(deps, ctx.organization.id, comment.instagramAccountId)
    if (!account.scopes.includes('instagram_business_manage_comments')) {
      throw new ApiError(403, 'forbidden', 'The connected account did not grant comment moderation')
    }
    await deps.meta.hideComment(account.token, comment.igCommentId, true)
    const updated = await deps.prisma.comment.update({ where: { id: comment.id }, data: { hidden: true } })
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'comment.hidden', targetId: comment.id })
    res.json({ comment: updated })
  }))

  router.delete('/api/comments/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.moderate')
    const comment = await loadComment(deps, ctx, req.params.id)
    const account = await usableToken(deps, ctx.organization.id, comment.instagramAccountId)
    if (!account.scopes.includes('instagram_business_manage_comments')) {
      throw new ApiError(403, 'forbidden', 'The connected account did not grant comment moderation')
    }
    await deps.meta.deleteComment(account.token, comment.igCommentId)
    const updated = await deps.prisma.comment.update({ where: { id: comment.id }, data: { deleted: true } })
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'comment.deleted', targetId: comment.id })
    res.json({ comment: updated })
  }))

  router.patch('/api/comments/:id/draft', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    const body = z.object({ text: z.string().max(2000) }).parse(req.body)
    const comment = await loadComment(deps, ctx, req.params.id)
    const text = body.text.trim()
    const updated = await deps.prisma.comment.update({
      where: { id: comment.id },
      data: { draftReply: text || null },
    })
    res.json({ comment: updated })
  }))

  router.delete('/api/comments/:id/draft', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    const comment = await loadComment(deps, ctx, req.params.id)
    const updated = await deps.prisma.comment.update({ where: { id: comment.id }, data: { draftReply: null } })
    res.json({ comment: updated })
  }))

  router.post('/api/comments/:id/private-reply', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    requireWritable(ctx)
    const body = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)
    const comment = await loadComment(deps, ctx, req.params.id)
    if (!comment.authorId) throw new ApiError(400, 'validation', 'This comment has no author')
    const conversation = await deps.prisma.conversation.upsert({
      where: {
        organizationId_instagramAccountId_participantId: {
          organizationId: ctx.organization.id,
          instagramAccountId: comment.instagramAccountId,
          participantId: comment.authorId,
        },
      },
      create: {
        organizationId: ctx.organization.id,
        instagramAccountId: comment.instagramAccountId,
        participantId: comment.authorId,
        participantUsername: comment.authorUsername,
      },
      update: {},
    })
    const decision = await decisionFor(deps, ctx, conversation, 'manual', true)
    if (!decision.allowed) {
      res.status(403).json({ error: { code: decision.code, message: decision.reason }, conversationId: conversation.id })
      return
    }
    const account = await usableToken(deps, ctx.organization.id, comment.instagramAccountId)
    const sent = await deps.meta.sendPrivateReply(account.token, account.igUserId, comment.igCommentId, body.text)
    await deps.prisma.conversation.update({ where: { id: conversation.id }, data: { privateReplySentAt: new Date() } })
    await deps.prisma.message.create({
      data: { organizationId: ctx.organization.id, conversationId: conversation.id, direction: 'outbound', body: body.text, igMessageId: sent.id, isPrivateReply: true },
    })
    await audit(deps.prisma, { organizationId: ctx.organization.id, actorType: 'user', actorId: ctx.user.id, action: 'message.private_reply', targetId: conversation.id })
    res.json({ conversationId: conversation.id })
  }))

  router.get('/api/conversations', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    if (!ctx.subscription.package.dmInbox) throw new ApiError(403, 'entitlement', 'This package does not include messages')
    const state = req.query.state === 'done' ? true : req.query.state === 'open' ? false : undefined
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id, ...(state === undefined ? {} : { done: state }) }
    const [total, conversations] = await Promise.all([
      deps.prisma.conversation.count({ where }),
      deps.prisma.conversation.findMany({ where, orderBy: { updatedAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ conversations, ...pageBody(page, total) })
  }))

  router.get('/api/conversations/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const conversation = await deps.prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: ctx.organization.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) throw notFound()
    const total = conversation.messages.length
    const pageCount = Math.max(1, Math.ceil(total / 20))
    const page = req.query.messagesPage === undefined ? pageCount : readPage(req.query, 'messagesPage')
    const start = (page - 1) * 20
    const decision = await decisionFor(deps, ctx, conversation, 'manual', false)
    res.json({
      conversation: { ...conversation, messages: conversation.messages.slice(start, start + 20) },
      send: decision,
      messagesPage: page,
      messagesPageSize: 20,
      messagesTotal: total,
    })
  }))

  router.post('/api/conversations/:id/suggest', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    if (!ctx.subscription.package.dmInbox) throw new ApiError(403, 'entitlement', 'This package does not include messages')
    const conversation = await deps.prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: ctx.organization.id },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!conversation) throw notFound()
    const text = await suggestReply(deps, ctx, 'dm_reply', conversation.messages[0]?.body ?? '')
    res.json({ text })
  }))

  router.post('/api/conversations/:id/messages', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const body = z.object({ text: z.string().min(1).max(2000) }).parse(req.body)
    const result = await sendConversationMessage(deps, ctx, req.params.id, body.text, 'manual')
    if (!result.allowed) {
      res.status(403).json({ error: { code: result.code, message: result.reason } })
      return
    }
    res.status(201).json({ ok: true })
  }))

  router.post('/api/conversations/:id/done', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const body = z.object({ done: z.boolean() }).parse(req.body)
    const conversation = await deps.prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!conversation) throw notFound()
    const updated = await deps.prisma.conversation.update({ where: { id: conversation.id }, data: { done: body.done } })
    res.json({ conversation: updated })
  }))

  router.post('/api/conversations/:id/assign', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const body = z.object({ userId: z.string() }).parse(req.body)
    const conversation = await deps.prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!conversation) throw notFound()
    const updated = await deps.prisma.conversation.update({ where: { id: conversation.id }, data: { assignedToId: body.userId } })
    res.json({ conversation: updated })
  }))

  router.patch('/api/conversations/:id/automation', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.automate')
    const body = z.object({ enabled: z.boolean() }).parse(req.body)
    const conversation = await deps.prisma.conversation.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!conversation) throw notFound()
    const updated = await deps.prisma.conversation.update({ where: { id: conversation.id }, data: { automationEnabled: body.enabled } })
    res.json({ conversation: updated })
  }))

  router.get('/api/saved-responses', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, responses] = await Promise.all([
      deps.prisma.savedResponse.count({ where }),
      deps.prisma.savedResponse.findMany({ where, orderBy: { title: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ responses, ...pageBody(page, total) })
  }))

  router.post('/api/saved-responses', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const body = z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(2000) }).parse(req.body)
    const response = await deps.prisma.savedResponse.create({ data: { organizationId: ctx.organization.id, title: body.title, body: body.body } })
    res.status(201).json({ response })
  }))

  router.patch('/api/saved-responses/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const row = await deps.prisma.savedResponse.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!row) throw notFound()
    const body = z.object({
      title: z.string().min(1).max(120).optional(),
      body: z.string().min(1).max(2000).optional(),
    }).parse(req.body)
    const response = await deps.prisma.savedResponse.update({ where: { id: row.id }, data: body })
    res.json({ response })
  }))

  router.delete('/api/saved-responses/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const row = await deps.prisma.savedResponse.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!row) throw notFound()
    await deps.prisma.savedResponse.delete({ where: { id: row.id } })
    res.json({ ok: true })
  }))

  router.get('/api/automation/rules', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requireAutomation(ctx)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, rules] = await Promise.all([
      deps.prisma.automationRule.count({ where }),
      deps.prisma.automationRule.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ rules, ...pageBody(page, total) })
  }))

  router.post('/api/automation/rules', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requireAutomation(ctx)
    const body = ruleBody.parse(req.body)
    const rule = await deps.prisma.automationRule.create({
      data: { organizationId: ctx.organization.id, ...body, config: body.config as Prisma.InputJsonValue },
    })
    res.status(201).json({ rule })
  }))

  router.patch('/api/automation/rules/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requireAutomation(ctx)
    const existing = await deps.prisma.automationRule.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    const body = ruleBody.partial().parse(req.body)
    const rule = await deps.prisma.automationRule.update({
      where: { id: existing.id },
      data: { ...body, config: body.config as Prisma.InputJsonValue | undefined },
    })
    res.json({ rule })
  }))

  router.delete('/api/automation/rules/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requireAutomation(ctx)
    const existing = await deps.prisma.automationRule.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    await deps.prisma.automationRule.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  }))

  router.get('/api/ideas', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, ideas] = await Promise.all([
      deps.prisma.idea.count({ where }),
      deps.prisma.idea.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ ideas, ...pageBody(page, total) })
  }))

  router.post('/api/ideas', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({ text: z.string().min(1).max(280) }).parse(req.body)
    const text = body.text.replace(/\s+/g, ' ').trim()
    if (!text) throw new ApiError(400, 'validation', 'Write a one-line idea')
    const idea = await deps.prisma.idea.create({ data: { organizationId: ctx.organization.id, text } })
    res.status(201).json({ idea })
  }))

  router.patch('/api/ideas/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const existing = await deps.prisma.idea.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    const body = z.object({ text: z.string().min(1).max(280) }).parse(req.body)
    const text = body.text.replace(/\s+/g, ' ').trim()
    if (!text) throw new ApiError(400, 'validation', 'Write a one-line idea')
    const idea = await deps.prisma.idea.update({ where: { id: existing.id }, data: { text } })
    res.json({ idea })
  }))

  router.delete('/api/ideas/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const existing = await deps.prisma.idea.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!existing) throw notFound()
    await deps.prisma.idea.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  }))

  router.post('/api/ideas/:id/draft', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const idea = await deps.prisma.idea.findFirst({ where: { id: req.params.id, organizationId: ctx.organization.id } })
    if (!idea) throw notFound()
    if (idea.postId) {
      const existing = await deps.prisma.post.findFirst({ where: { id: idea.postId, organizationId: ctx.organization.id }, include: postInclude })
      if (existing) {
        res.json({ post: presentPost(deps, existing), idea })
        return
      }
    }
    const post = await deps.prisma.post.create({
      data: {
        organizationId: ctx.organization.id,
        format: 'photo',
        status: 'DRAFT',
        description: idea.text,
        caption: '',
        generatedCaption: '',
        keywords: [],
        hashtags: [],
        alternativeCaptions: [],
        factualClaims: [],
      },
      include: postInclude,
    })
    const updated = await deps.prisma.idea.update({ where: { id: idea.id }, data: { postId: post.id } })
    res.status(201).json({ post: presentPost(deps, post), idea: updated })
  }))

  router.get('/api/plans', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const page = readPage(req.query)
    const where = { organizationId: ctx.organization.id }
    const [total, plans] = await Promise.all([
      deps.prisma.contentPlan.count({ where }),
      deps.prisma.contentPlan.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    const counts = await planCounts(deps, plans.map((plan) => plan.id))
    res.json({ plans: plans.map((plan) => presentPlan(plan, counts.get(plan.id))), timezone: await planTimeZone(deps, ctx), ...pageBody(page, total) })
  }))

  router.post('/api/plans', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requirePermission(ctx, 'ai.use')
    const body = planBody.parse(req.body)
    const result = await createPlan(deps, ctx, {
      range: body.range,
      startDate: body.startDate,
      postsPerDay: body.postsPerDay,
      weekdays: [...new Set(body.weekdays)].sort(),
      formats: [...new Set(body.formats)],
      socialAccountIds: [...new Set(body.socialAccountIds)],
      goal: body.goal,
      topics: body.topics.map((topic) => topic.trim()).filter(Boolean),
      promotions: body.promotions,
      tone: body.tone,
      language: body.language,
      useBestTimes: body.useBestTimes,
      campaignId: body.campaignId ?? null,
    })
    res.status(201).json({
      ...(await planPayload(deps, ctx, result.plan.id, 1)),
      copyErrors: result.copyErrors,
      notice: result.notice,
    })
  }))

  router.get('/api/plans/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    res.json(await planPayload(deps, ctx, req.params.id, readPage(req.query)))
  }))

  router.patch('/api/plans/:id/posts/:postId', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      caption: z.string().max(2200).optional(),
      description: z.string().min(1).max(4000).optional(),
      hashtags: z.array(z.object({ tag: z.string(), enabled: z.boolean() })).max(HASHTAG_LIMIT).optional(),
      scheduledAt: z.string().optional(),
      format: z.enum(POST_FORMATS).optional(),
      socialAccountIds: z.array(z.string()).max(12).optional(),
    }).parse(req.body)
    await editPlanPost(deps, ctx, req.params.id, req.params.postId, body)
    res.json(await planPayload(deps, ctx, req.params.id, readPage(req.query)))
  }))

  router.post('/api/plans/:id/posts/delete', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({ postIds: z.array(z.string()).min(1).max(PLAN_POST_LIMIT) }).parse(req.body)
    const result = await deletePlanPosts(deps, ctx, req.params.id, body.postIds)
    res.json({ ...result, ...(await planPayload(deps, ctx, req.params.id, readPage(req.query))) })
  }))

  router.delete('/api/plans/:id/posts/:postId', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    await deletePlanPost(deps, ctx, req.params.id, req.params.postId)
    res.json({ ok: true })
  }))

  router.delete('/api/plans/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const result = await deletePlan(deps, ctx, req.params.id)
    res.json({ ok: true, ...result })
  }))

  router.post('/api/plans/:id/approve', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.publish')
    const body = z.object({ postIds: z.array(z.string()).min(1).max(PLAN_POST_LIMIT).optional() }).parse(req.body ?? {})
    const result = await approvePlan(deps, ctx, req.params.id, body.postIds)
    res.json({ ...result, ...(await planPayload(deps, ctx, req.params.id, readPage(req.query))) })
  }))

  router.post('/api/plans/:id/regenerate', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requirePermission(ctx, 'ai.use')
    const result = await regenerateWholePlan(deps, ctx, req.params.id)
    res.json({ ...result, ...(await planPayload(deps, ctx, req.params.id, readPage(req.query))) })
  }))

  router.post('/api/plans/:id/posts/:postId/regenerate', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requirePermission(ctx, 'ai.use')
    const result = await regeneratePlanPost(deps, ctx, req.params.id, req.params.postId)
    res.json({ ...result, ...(await planPayload(deps, ctx, req.params.id, readPage(req.query))) })
  }))

  router.post('/api/plans/:id/posts/:postId/media', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    requirePermission(ctx, 'ai.generateMedia')
    const plan = await loadPlan(deps, ctx, req.params.id)
    const post = await deps.prisma.post.findFirst({ where: { id: req.params.postId, planId: plan.id, organizationId: ctx.organization.id } })
    if (!post) throw notFound('Post not found in this plan')
    if (post.status === 'PUBLISHED' || post.status === 'PUBLISHING') throw new ApiError(409, 'validation', 'A published post cannot get new media')
    const result = await startMediaJob(deps, ctx, post.id)
    res.status(202).json({ jobId: result.jobId, ...(await planPayload(deps, ctx, plan.id, readPage(req.query))) })
  }))

  router.get('/api/audience-times', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const snapshot = await deps.prisma.metricSnapshot.findFirst({
      where: { organizationId: ctx.organization.id, metric: 'audience_online' },
      orderBy: { capturedAt: 'desc' },
    })
    res.json({ hours: storedAudienceHours(snapshot?.dimensions) })
  }))

  router.get('/api/reports', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'insights.read')
    const from = reportDay(typeof req.query.from === 'string' ? req.query.from : '', false)
    const to = reportDay(typeof req.query.to === 'string' ? req.query.to : '', true)
    if (!from || !to || from > to) throw new ApiError(400, 'validation', 'Choose a start and end date')
    const report = await storedReport(deps, ctx.organization.id, from, to)
    const page = readPage(req.query)
    const paged = slicePage(report.rows, page)
    res.json({ from: report.from, to: report.to, rows: paged.items, page: paged.page, pageSize: paged.pageSize, total: paged.total })
  }))

  router.get('/api/insights', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'insights.read')
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined
    res.json(await insightsFor(deps, ctx, accountId))
  }))

  return router
}

const PLAN_POST_LIMIT = 31

const planBody = z.object({
  range: z.enum(PLAN_RANGES),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  postsPerDay: z.number().int().min(1).max(3).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  formats: z.array(z.enum(POST_FORMATS)).min(1).max(5),
  socialAccountIds: z.array(z.string()).min(1).max(12),
  goal: z.string().trim().min(3).max(500),
  topics: z.array(z.string().max(200)).max(20).default([]),
  promotions: z.string().max(1000).default(''),
  tone: z.string().max(200).default(''),
  language: z.string().max(100).default(''),
  useBestTimes: z.boolean().default(false),
  campaignId: z.string().nullish(),
})

type PlanCounts = { total: number; pending: number; scheduled: number; published: number; failed: number }

function presentPlan(plan: { id: string; range: string; startsAt: Date; endsAt: Date; inputs: Prisma.JsonValue; status: string; campaignId: string | null; createdAt: Date; updatedAt: Date }, counts?: PlanCounts) {
  return {
    id: plan.id,
    range: plan.range,
    startsAt: plan.startsAt,
    endsAt: plan.endsAt,
    inputs: readPlanInputs(plan.inputs),
    status: plan.status,
    campaignId: plan.campaignId,
    counts: counts ?? { total: 0, pending: 0, scheduled: 0, published: 0, failed: 0 },
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  }
}

async function planPayload(deps: Deps, ctx: CustomerContext, planId: string, page: number) {
  const plan = await loadPlan(deps, ctx, planId)
  const where = { planId: plan.id, organizationId: ctx.organization.id }
  const [total, posts, counts, timezone] = await Promise.all([
    deps.prisma.post.count({ where }),
    deps.prisma.post.findMany({ where, include: postInclude, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }], ...pageArgs(page) }),
    planCounts(deps, [plan.id]),
    planTimeZone(deps, ctx),
  ])
  const states = await mediaStates(deps, posts)
  return {
    plan: presentPlan(plan, counts.get(plan.id)),
    posts: posts.map((post) => ({
      ...presentPost(deps, post),
      mediaState: states.get(post.id)?.state ?? 'none',
      mediaError: states.get(post.id)?.error ?? null,
    })),
    timezone,
    ...pageBody(page, total),
  }
}

const ruleBody = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(['faq_comment', 'business_hours_dm', 'human_request', 'complaint', 'scheduled_publish']),
  enabled: z.boolean().default(true),
  matchText: z.string().max(500).optional(),
  approvedAnswer: z.string().max(2000).optional(),
  config: z.record(z.unknown()).optional(),
})

function requireAutomation(ctx: CustomerContext): void {
  if (!ctx.membership.role || (ctx.membership.role !== 'OWNER' && ctx.membership.role !== 'ADMIN')) {
    throw new ApiError(403, 'forbidden', 'You do not have permission to do that')
  }
  if (!ctx.settings.features.inboxAutomation) throw new ApiError(403, 'feature_disabled', 'Inbox automation is turned off for the whole site')
  if (!ctx.subscription.package.automation) throw new ApiError(403, 'entitlement', `${ctx.subscription.package.name} does not include automation`)
}

export async function loadPost(deps: Deps, ctx: CustomerContext, id: string) {
  const post = await deps.prisma.post.findFirst({ where: { id, organizationId: ctx.organization.id }, include: postInclude })
  if (!post) throw notFound()
  return post
}

async function loadComment(deps: Deps, ctx: CustomerContext, id: string) {
  const comment = await deps.prisma.comment.findFirst({ where: { id, organizationId: ctx.organization.id } })
  if (!comment) throw notFound()
  return comment
}
