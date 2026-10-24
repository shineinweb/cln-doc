import {
  HASHTAG_LIMIT,
  claimsBlockPublish,
  normalizeKeywords,
  parseHashtags,
  type HashtagChip,
} from '@instagram-ai/shared'
import type { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { encryptString, newSecret, sha256 } from '../crypto'
import { asyncRoute } from '../http'
import { audit } from '../audit'
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
import { generateCopyForPost, generateIdea, keptHashtags, parseClaims, publishPost, startMediaJob } from '../services/content'
import { decisionFor, sendConversationMessage, suggestReply } from '../services/inbox'
import { deleteOrganization, insightsFor, usageCounts } from '../services/platform'
import { enqueuePublish } from '../queues'

const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function authed(deps: Deps, req: Parameters<typeof requireCustomer>[1]) {
  return requireCustomer(deps, req)
}

function presentPost(deps: Deps, post: {
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
  createdAt: Date
  updatedAt: Date
  media?: Array<{ position: number; asset: { id: string; mimeType: string; storageKey: string; filename: string } }>
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
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    media: (post.media ?? []).map((item) => ({
      id: item.asset.id,
      url: deps.storage.url(item.asset.storageKey),
      mimeType: item.asset.mimeType,
      filename: item.asset.filename,
      position: item.position,
    })),
  }
}

const postInclude = { media: { include: { asset: true }, orderBy: { position: 'asc' as const } } }

export function customerRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/dashboard', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const [scheduledPosts, awaitingApproval, unansweredComments, errors, usage] = await Promise.all([
      deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'SCHEDULED' } }),
      deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'PENDING_APPROVAL' } }),
      deps.prisma.comment.count({ where: { organizationId: ctx.organization.id, replied: false, deleted: false } }),
      deps.prisma.post.findMany({
        where: { organizationId: ctx.organization.id, status: 'FAILED' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { id: true, publishError: true, updatedAt: true },
      }),
      usageCounts(deps, ctx.organization.id, ctx.subscription.currentPeriodStart, ctx.subscription.currentPeriodEnd),
    ])
    res.json({
      scheduledPosts,
      awaitingApproval,
      unansweredComments,
      aiQuota: { used: usage.text, limit: ctx.subscription.package.monthlyAiGenerations },
      publishingErrors: errors,
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
    const members = await deps.prisma.membership.findMany({
      where: { organizationId: ctx.organization.id },
      include: { user: true },
    })
    res.json({
      members: members.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        disabled: member.user.disabled,
      })),
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
      instructions: z.string().max(4000).optional(),
      modelId: z.string().optional(),
      providerKey: z.string().min(8).max(300).optional(),
      tone: z.string().max(500).optional(),
      language: z.string().max(20).optional(),
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
    const knowledge = await deps.prisma.aiKnowledge.findMany({ where: { organizationId: ctx.organization.id }, orderBy: { createdAt: 'desc' } })
    res.json({ knowledge })
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
    const categories = await deps.prisma.contentCategory.findMany({ where: { organizationId: ctx.organization.id } })
    res.json({ categories })
  }))

  router.post('/api/categories', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      name: z.string().min(1).max(80),
      styleNotes: z.string().max(2000).default(''),
      defaultFormat: z.enum(['photo', 'carousel', 'reel']).default('photo'),
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
      defaultFormat: z.enum(['photo', 'carousel', 'reel']).optional(),
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
    const authorizeUrl = await startInstagramConnect(deps, ctx, reconnectId)
    res.json({ authorizeUrl })
  }))

  router.get('/api/integrations/instagram/callback', asyncRoute(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : ''
    const state = typeof req.query.state === 'string' ? req.query.state : ''
    if (!code || !state) throw new ApiError(400, 'validation', 'Instagram did not return a code')
    await finishInstagramConnect(deps, code, state)
    res.redirect(`${deps.env.WEB_ORIGIN}/app/settings/instagram?connected=1`)
  }))

  router.get('/api/instagram/accounts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const accounts = await deps.prisma.instagramAccount.findMany({ where: { organizationId: ctx.organization.id } })
    res.json({ accounts: accounts.map(presentAccount) })
  }))

  router.delete('/api/instagram/accounts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'instagram.connect')
    await disconnectInstagram(deps, ctx.organization.id, req.params.id)
    res.json({ ok: true })
  }))

  router.get('/api/posts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined
    const posts = await deps.prisma.post.findMany({
      where: {
        organizationId: ctx.organization.id,
        ...(from || to ? { scheduledAt: { gte: from, lte: to } } : {}),
      },
      include: postInclude,
      orderBy: { updatedAt: 'desc' },
    })
    const account = await deps.prisma.instagramAccount.findFirst({ where: { organizationId: ctx.organization.id, status: 'connected' } })
    res.json({ posts: posts.map((post) => presentPost(deps, post)), timezone: account?.timezone ?? ctx.organization.timezone })
  }))

  router.post('/api/posts', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'posts.write')
    const body = z.object({
      format: z.enum(['photo', 'carousel', 'reel']).default('photo'),
      description: z.string().max(4000).default(''),
      caption: z.string().max(2200).default(''),
      categoryId: z.string().optional(),
      instagramAccountId: z.string().optional(),
    }).parse(req.body)
    if (body.categoryId) {
      const category = await deps.prisma.contentCategory.findFirst({ where: { id: body.categoryId, organizationId: ctx.organization.id } })
      if (!category) throw notFound('Category not found')
    }
    const post = await deps.prisma.post.create({
      data: {
        organizationId: ctx.organization.id,
        format: body.format,
        description: body.description,
        caption: body.caption,
        generatedCaption: '',
        keywords: [],
        hashtags: [],
        alternativeCaptions: [],
        factualClaims: [],
        categoryId: body.categoryId,
        instagramAccountId: body.instagramAccountId,
      },
      include: postInclude,
    })
    res.status(201).json({ post: presentPost(deps, post) })
  }))

  router.get('/api/posts/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    const post = await loadPost(deps, ctx, req.params.id)
    const jobs = await deps.prisma.generationJob.findMany({ where: { postId: post.id }, orderBy: { createdAt: 'desc' }, take: 1 })
    res.json({ post: presentPost(deps, post), job: jobs[0] ?? null })
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
      format: z.enum(['photo', 'carousel', 'reel']).optional(),
    }).parse(req.body)
    if (body.hashtags && body.hashtags.length > HASHTAG_LIMIT) {
      throw new ApiError(400, 'validation', 'A post can keep at most 10 hashtags')
    }
    const hashtags = body.hashtags ? keptHashtags(body.hashtags as HashtagChip[]) : undefined
    if (body.hashtags && hashtags && hashtags.length !== body.hashtags.length) {
      throw new ApiError(400, 'validation', 'A post can keep at most 10 hashtags')
    }
    const post = await deps.prisma.post.update({
      where: { id: existing.id },
      data: {
        caption: body.caption,
        description: body.description,
        keywords: body.keywords ? normalizeKeywords(body.keywords) : undefined,
        hashtags: hashtags as unknown as Prisma.InputJsonValue,
        instagramAccountId: body.instagramAccountId === undefined ? undefined : body.instagramAccountId,
        format: body.format,
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
    if (!IMAGE.has(file.mimeType)) throw new ApiError(400, 'validation', 'Reference photos must be PNG, JPEG, or WebP')
    const storageKey = await deps.storage.put(file.buffer, extensionFor(file.mimeType, file.filename))
    const asset = await deps.prisma.mediaAsset.create({
      data: { organizationId: ctx.organization.id, kind: 'reference', storageKey, mimeType: file.mimeType, filename: file.filename },
    })
    res.status(201).json({ asset: { id: asset.id, url: deps.storage.url(asset.storageKey), filename: asset.filename } })
  }))

  router.post('/api/posts/:id/generate', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'ai.generateMedia')
    const body = z.object({ referenceAssetId: z.string().optional() }).parse(req.body ?? {})
    const result = await startMediaJob(deps, ctx, req.params.id, body.referenceAssetId)
    const post = await loadPost(deps, ctx, req.params.id)
    const job = await deps.prisma.generationJob.findUnique({ where: { id: result.jobId } })
    res.status(202).json({ post: presentPost(deps, post), job, copyError: result.copyError })
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
    const updated = await deps.prisma.post.update({
      where: { id: post.id },
      data: { status: 'SCHEDULED', scheduledAt },
      include: postInclude,
    })
    await enqueuePublish(deps, post.id, scheduledAt.getTime() - Date.now())
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
    const updated = await deps.prisma.post.update({ where: { id: post.id }, data: { status: 'CANCELED' }, include: postInclude })
    res.json({ post: presentPost(deps, updated) })
  }))

  router.get('/api/seo-sets', asyncRoute(async (req, res) => {
    await authed(deps, req)
    const sets = await deps.prisma.seoSet.findMany({ orderBy: { name: 'asc' } })
    res.json({ sets })
  }))

  router.get('/api/comments', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'comments.reply')
    if (!ctx.subscription.package.commentInbox) throw new ApiError(403, 'entitlement', 'This package does not include the comment inbox')
    const comments = await deps.prisma.comment.findMany({
      where: {
        organizationId: ctx.organization.id,
        ...(typeof req.query.accountId === 'string' ? { instagramAccountId: req.query.accountId } : {}),
        ...(typeof req.query.igMediaId === 'string' ? { igMediaId: req.query.igMediaId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ comments })
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
    const conversations = await deps.prisma.conversation.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ conversations })
  }))

  router.get('/api/conversations/:id', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const conversation = await deps.prisma.conversation.findFirst({
      where: { id: req.params.id, organizationId: ctx.organization.id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
    if (!conversation) throw notFound()
    const decision = await decisionFor(deps, ctx, conversation, 'manual', false)
    res.json({ conversation, send: decision })
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
    const responses = await deps.prisma.savedResponse.findMany({ where: { organizationId: ctx.organization.id } })
    res.json({ responses })
  }))

  router.post('/api/saved-responses', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'messages.reply')
    const body = z.object({ title: z.string().min(1).max(120), body: z.string().min(1).max(2000) }).parse(req.body)
    const response = await deps.prisma.savedResponse.create({ data: { organizationId: ctx.organization.id, title: body.title, body: body.body } })
    res.status(201).json({ response })
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
    const rules = await deps.prisma.automationRule.findMany({ where: { organizationId: ctx.organization.id } })
    res.json({ rules })
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

  router.get('/api/insights', asyncRoute(async (req, res) => {
    const ctx = await authed(deps, req)
    requirePermission(ctx, 'insights.read')
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined
    res.json(await insightsFor(deps, ctx, accountId))
  }))

  return router
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

async function loadPost(deps: Deps, ctx: CustomerContext, id: string) {
  const post = await deps.prisma.post.findFirst({ where: { id, organizationId: ctx.organization.id }, include: postInclude })
  if (!post) throw notFound()
  return post
}

async function loadComment(deps: Deps, ctx: CustomerContext, id: string) {
  const comment = await deps.prisma.comment.findFirst({ where: { id, organizationId: ctx.organization.id } })
  if (!comment) throw notFound()
  return comment
}
