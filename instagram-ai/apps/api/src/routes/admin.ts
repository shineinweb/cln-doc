import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { hashPassword } from '../crypto'
import { asyncRoute } from '../http'
import { audit } from '../audit'
import { requireStaff, requireStaffRole } from '../services/context'
import { oauthAppFlags, providerSecretFlags, readProviderEnabled, saveSettings, writeOauthApps, writeProviderSecrets, type SiteSettings } from '../settings'
import { disconnectInstagram, presentAccount } from '../services/instagram'
import { pageArgs, pageBody, readPage, slicePage } from '../paging'
import { deleteOrganization } from '../services/platform'

const SECRET_KEYS = ['accessToken', 'accessTokenEnc', 'providerKey', 'providerKeyEnc', 'password', 'passwordHash', 'token', 'appSecret', 'openaiKey', 'runwayKey', 'videoProviderUrl', 'clientId', 'clientSecret']

export function adminRoutes(deps: Deps): Router {
  const router = Router()

  router.get('/api/admin/dashboard', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const [organizations, users, subscriptions] = await Promise.all([
      deps.prisma.organization.count(),
      deps.prisma.user.count(),
      deps.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    res.json({
      organizations,
      users,
      subscriptions: Object.fromEntries(subscriptions.map((row) => [row.status, row._count._all])),
    })
  }))

  router.get('/api/admin/organizations', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const page = readPage(req.query)
    const where = q ? { name: { contains: q } } : {}
    const [total, organizations] = await Promise.all([
      deps.prisma.organization.count({ where }),
      deps.prisma.organization.findMany({
        where,
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(page),
      }),
    ])
    res.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        suspended: org.suspended,
        packageId: org.subscription?.packageId,
        status: org.subscription?.status,
      })),
      ...pageBody(page, total),
    })
  }))

  router.get('/api/admin/organizations/:id', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const org = await deps.prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        subscription: { include: { package: true } },
        memberships: { include: { user: true } },
        instagramAccounts: true,
        brandProfile: true,
        contentCategories: true,
      },
    })
    if (!org) throw notFound()
    const usage = await deps.prisma.aiUsage.groupBy({
      by: ['kind'],
      where: { organizationId: org.id },
      _count: { _all: true },
    })
    const body = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      suspended: org.suspended,
      timezone: org.timezone,
      subscription: org.subscription && {
        status: org.subscription.status,
        packageId: org.subscription.packageId,
        packageName: org.subscription.package.name,
        seats: org.subscription.seatsOverride ?? org.subscription.package.seats,
        currentPeriodEnd: org.subscription.currentPeriodEnd,
      },
      ...pagedMembers(org.memberships.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        disabled: member.user.disabled,
      })), readPage(req.query, 'membersPage')),
      ...pagedAccounts(org.instagramAccounts.map(presentAccount), readPage(req.query, 'accountsPage')),
      brandProfile: org.brandProfile,
      categories: org.contentCategories,
      usage: Object.fromEntries(usage.map((row) => [row.kind, row._count._all])),
    }
    assertNoSecrets(body)
    res.json(body)
  }))

  router.patch('/api/admin/organizations/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const org = await deps.prisma.organization.findUnique({ where: { id: req.params.id } })
    if (!org) throw notFound()
    const body = z.object({
      suspended: z.boolean().optional(),
      packageId: z.string().optional(),
      seats: z.number().int().positive().optional(),
      timezone: z.string().optional(),
      brand: z.object({
        brandName: z.string().optional(),
        businessDescription: z.string().optional(),
        targetAudience: z.string().optional(),
        voiceAndTone: z.string().optional(),
        productsAndServices: z.string().optional(),
        approvedFacts: z.array(z.string()).optional(),
        topicsToAvoid: z.string().optional(),
        preferredLanguage: z.string().optional(),
      }).optional(),
      categories: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        styleNotes: z.string().default(''),
        defaultFormat: z.enum(['photo', 'carousel', 'reel']).default('photo'),
      })).optional(),
    }).parse(req.body)
    if (body.suspended !== undefined || body.timezone) {
      await deps.prisma.organization.update({
        where: { id: org.id },
        data: { suspended: body.suspended, timezone: body.timezone },
      })
    }
    if (body.packageId || body.seats) {
      if (body.packageId) {
        const pkg = await deps.prisma.package.findUnique({ where: { id: body.packageId } })
        if (!pkg) throw notFound('Package not found')
      }
      await deps.prisma.subscription.update({
        where: { organizationId: org.id },
        data: { packageId: body.packageId, seatsOverride: body.seats },
      })
    }
    if (body.brand) {
      await deps.prisma.brandProfile.update({ where: { organizationId: org.id }, data: body.brand })
    }
    if (body.categories) {
      await deps.prisma.contentCategory.deleteMany({ where: { organizationId: org.id } })
      await deps.prisma.contentCategory.createMany({
        data: body.categories.map((category) => ({
          organizationId: org.id,
          name: category.name,
          styleNotes: category.styleNotes,
          defaultFormat: category.defaultFormat,
        })),
      })
    }
    await audit(deps.prisma, {
      organizationId: org.id,
      actorType: 'staff',
      actorId: ctx.staff.id,
      action: 'organization.updated',
      metadata: body as Prisma.InputJsonValue,
    })
    res.json({ ok: true })
  }))

  router.patch('/api/admin/organizations/:id/members/:userId', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ role: z.enum(['ADMIN', 'EDITOR', 'SUPPORT']) }).parse(req.body)
    const membership = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: req.params.id, userId: req.params.userId } },
    })
    if (!membership) throw notFound()
    if (membership.role === 'OWNER') throw new ApiError(403, 'forbidden', 'The owner role stays with the owner')
    await deps.prisma.membership.update({ where: { id: membership.id }, data: { role: body.role } })
    await audit(deps.prisma, { organizationId: req.params.id, actorType: 'staff', actorId: ctx.staff.id, action: 'membership.role_changed', targetId: membership.userId, metadata: { role: body.role } })
    res.json({ ok: true })
  }))

  router.delete('/api/admin/organizations/:id/members/:userId', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const membership = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: req.params.id, userId: req.params.userId } },
    })
    if (!membership) throw notFound()
    if (membership.role === 'OWNER') throw new ApiError(403, 'forbidden', 'The owner cannot be removed')
    await deps.prisma.membership.delete({ where: { id: membership.id } })
    await audit(deps.prisma, { organizationId: req.params.id, actorType: 'staff', actorId: ctx.staff.id, action: 'membership.removed', targetId: membership.userId })
    res.json({ ok: true })
  }))

  router.delete('/api/admin/organizations/:id/accounts/:accountId', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const account = await deps.prisma.instagramAccount.findFirst({ where: { id: req.params.accountId, organizationId: req.params.id } })
    if (!account) throw notFound()
    await disconnectInstagram(deps, req.params.id, account.id)
    await audit(deps.prisma, { organizationId: req.params.id, actorType: 'staff', actorId: ctx.staff.id, action: 'instagram.disconnected', targetId: account.id })
    res.json({ ok: true })
  }))

  router.delete('/api/admin/organizations/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const org = await deps.prisma.organization.findUnique({ where: { id: req.params.id } })
    if (!org) throw notFound()
    await deleteOrganization(deps, org.id, ctx.staff.id, 'staff')
    res.json({ ok: true })
  }))

  router.get('/api/admin/users', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const page = readPage(req.query)
    const where = q ? { email: { contains: q } } : {}
    const [total, users] = await Promise.all([
      deps.prisma.user.count({ where }),
      deps.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({
      users: users.map((user) => ({ id: user.id, email: user.email, name: user.name, disabled: user.disabled })),
      ...pageBody(page, total),
    })
  }))

  router.post('/api/admin/users/:id/disable', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ disabled: z.boolean() }).parse(req.body)
    const user = await deps.prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) throw notFound()
    await deps.prisma.user.update({ where: { id: user.id }, data: { disabled: body.disabled } })
    if (body.disabled) await deps.prisma.session.deleteMany({ where: { userId: user.id } })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'user.disabled', targetId: user.id, metadata: { disabled: body.disabled } })
    res.json({ ok: true })
  }))

  router.patch('/api/admin/users/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ name: z.string().min(1).max(120) }).parse(req.body)
    const user = await deps.prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) throw notFound()
    const updated = await deps.prisma.user.update({ where: { id: user.id }, data: { name: body.name } })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'user.updated', targetId: user.id })
    res.json({ user: { id: updated.id, email: updated.email, name: updated.name, disabled: updated.disabled } })
  }))

  router.delete('/api/admin/users/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const user = await deps.prisma.user.findUnique({ where: { id: req.params.id } })
    if (!user) throw notFound()
    const owner = await deps.prisma.membership.findFirst({ where: { userId: user.id, role: 'OWNER' } })
    if (owner) throw new ApiError(409, 'validation', 'Transfer ownership before deleting this user')
    await deps.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId: user.id } })
      await tx.passwordReset.deleteMany({ where: { userId: user.id } })
      await tx.invitation.deleteMany({ where: { invitedById: user.id } })
      await tx.membership.deleteMany({ where: { userId: user.id } })
      await tx.user.delete({ where: { id: user.id } })
    })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'user.deleted', targetId: user.id })
    res.json({ ok: true })
  }))

  router.get('/api/admin/packages', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const page = readPage(req.query)
    const [total, packages] = await Promise.all([
      deps.prisma.package.count(),
      deps.prisma.package.findMany({ orderBy: { sortOrder: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ packages, ...pageBody(page, total) })
  }))

  router.patch('/api/admin/packages/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const pkg = await deps.prisma.package.findUnique({ where: { id: req.params.id } })
    if (!pkg) throw notFound()
    const body = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      priceMinor: z.number().int().nonnegative().optional(),
      currency: z.string().length(3).optional(),
      instagramAccounts: z.number().int().positive().optional(),
      seats: z.number().int().positive().optional(),
      monthlyAiGenerations: z.number().int().nonnegative().optional(),
      monthlyImageGenerations: z.number().int().nonnegative().optional(),
      monthlyVideoGenerations: z.number().int().nonnegative().optional(),
      scheduling: z.boolean().optional(),
      commentInbox: z.boolean().optional(),
      dmInbox: z.boolean().optional(),
      automation: z.boolean().optional(),
      customAi: z.boolean().optional(),
      videoGeneration: z.boolean().optional(),
    }).parse(req.body)
    const updated = await deps.prisma.package.update({ where: { id: pkg.id }, data: body })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'package.updated', targetId: pkg.id })
    res.json({ package: updated })
  }))

  router.delete('/api/admin/packages/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const pkg = await deps.prisma.package.findUnique({ where: { id: req.params.id } })
    if (!pkg) throw notFound()
    const used = await deps.prisma.subscription.count({ where: { packageId: pkg.id } })
    if (used) throw new ApiError(409, 'validation', 'This package is still assigned to a subscription')
    await deps.prisma.package.delete({ where: { id: pkg.id } })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'package.deleted', targetId: pkg.id })
    res.json({ ok: true })
  }))

  router.get('/api/admin/subscriptions', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const page = readPage(req.query)
    const [total, subscriptions] = await Promise.all([
      deps.prisma.subscription.count(),
      deps.prisma.subscription.findMany({ include: { package: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        organizationId: subscription.organizationId,
        packageId: subscription.packageId,
        status: subscription.status,
        seats: subscription.seatsOverride ?? subscription.package.seats,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })),
      ...pageBody(page, total),
    })
  }))

  router.patch('/api/admin/subscriptions/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ status: z.enum(['trialing', 'active', 'past_due', 'canceled']).optional(), packageId: z.string().optional() }).parse(req.body)
    const subscription = await deps.prisma.subscription.findUnique({ where: { id: req.params.id } })
    if (!subscription) throw notFound()
    const updated = await deps.prisma.subscription.update({ where: { id: subscription.id }, data: body })
    await audit(deps.prisma, { organizationId: subscription.organizationId, actorType: 'staff', actorId: ctx.staff.id, action: 'subscription.updated', targetId: subscription.id, metadata: body })
    res.json({ subscription: { id: updated.id, status: updated.status, packageId: updated.packageId } })
  }))

  router.get('/api/admin/usage', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const grouped = await deps.prisma.aiUsage.groupBy({ by: ['organizationId', 'kind'], _count: { _all: true } })
    const rows = grouped
      .map((row) => ({ organizationId: row.organizationId, kind: row.kind, count: row._count._all }))
      .sort((a, b) => a.organizationId.localeCompare(b.organizationId) || a.kind.localeCompare(b.kind))
    const paged = slicePage(rows, readPage(req.query))
    res.json({ usage: paged.items, page: paged.page, pageSize: paged.pageSize, total: paged.total })
  }))

  router.get('/api/admin/provider-status', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const flags = await providerSecretFlags(deps.prisma)
    assertNoSecrets(flags)
    res.json(flags)
  }))

  router.put('/api/admin/provider-secrets', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      openaiKey: z.string().max(500).nullable().optional(),
      runwayKey: z.string().max(500).nullable().optional(),
      videoProviderUrl: z.string().max(2000).nullable().optional(),
      openaiEnabled: z.boolean().optional(),
      runwayEnabled: z.boolean().optional(),
      videoProviderUrlEnabled: z.boolean().optional(),
    }).parse(req.body)
    const touchesSecrets = body.openaiKey !== undefined || body.runwayKey !== undefined || body.videoProviderUrl !== undefined
    try {
      const before = await readProviderEnabled(deps.prisma)
      const flags = await writeProviderSecrets(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY, body)
      assertNoSecrets(flags)
      const after = { openai: flags.openaiEnabled, runway: flags.runwayEnabled, videoProvider: flags.videoProviderUrlEnabled }
      const changed = (Object.keys(after) as Array<keyof typeof after>).filter((name) => before[name] !== after[name])
      if (touchesSecrets || changed.length === 0) {
        await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'settings.providers' })
      }
      for (const name of changed) {
        await audit(deps.prisma, {
          actorType: 'staff',
          actorId: ctx.staff.id,
          action: 'settings.provider_toggle',
          targetType: 'provider',
          targetId: name,
          metadata: { provider: name, enabled: after[name] },
        })
      }
      res.json(flags)
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError(400, 'validation', error instanceof Error ? error.message : 'Invalid provider settings')
    }
  }))

  router.get('/api/admin/oauth-apps', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const flags = await oauthAppFlags(deps.prisma)
    assertNoSecrets(flags)
    res.json(flags)
  }))

  router.put('/api/admin/oauth-apps', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const pair = z.object({
      clientId: z.string().max(500).nullable().optional(),
      clientSecret: z.string().max(500).nullable().optional(),
    })
    const body = z.object({
      instagram: pair.optional(),
      facebook: pair.optional(),
      tiktok: pair.optional(),
      youtube: pair.optional(),
      google: pair.optional(),
    }).parse(req.body)
    const flags = await writeOauthApps(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY, body)
    assertNoSecrets(flags)
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'settings.oauth' })
    res.json(flags)
  }))

  router.get('/api/admin/settings', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    res.json({
      settings: publicSettings(ctx.settings),
      platformKeySet: Boolean(deps.env.TEXT_PROVIDER_KEY),
      metaAppIdSet: Boolean(deps.env.META_APP_ID),
    })
  }))

  router.put('/api/admin/settings', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      general: z.record(z.unknown()).optional(),
      legal: z.record(z.unknown()).optional(),
      features: z.record(z.unknown()).optional(),
      ai: z.record(z.unknown()).optional(),
      instagram: z.record(z.unknown()).optional(),
      email: z.record(z.unknown()).optional(),
      seo: z.record(z.unknown()).optional(),
      robots: z.string().optional(),
    }).parse(req.body)
    const settings = await saveSettings(deps.prisma, body as Partial<SiteSettings>, deps.env.META_REDIRECT_URI)
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'settings.updated' })
    res.json({ settings: publicSettings(settings), platformKeySet: Boolean(deps.env.TEXT_PROVIDER_KEY), metaAppIdSet: Boolean(deps.env.META_APP_ID) })
  }))

  router.get('/api/admin/seo/pages', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const page = readPage(req.query)
    const [total, pages] = await Promise.all([
      deps.prisma.publicPage.count(),
      deps.prisma.publicPage.findMany({ orderBy: { path: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ pages, ...pageBody(page, total) })
  }))

  router.put('/api/admin/seo/pages/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      path: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      ogImage: z.string().optional(),
      indexed: z.boolean().optional(),
      inSitemap: z.boolean().optional(),
    }).parse(req.body)
    const page = await deps.prisma.publicPage.update({ where: { id: req.params.id }, data: body })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'seo.updated', targetId: page.id })
    res.json({ page })
  }))

  router.delete('/api/admin/seo/pages/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const existing = await deps.prisma.publicPage.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound()
    await deps.prisma.publicPage.delete({ where: { id: existing.id } })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'seo.deleted', targetId: existing.id })
    res.json({ ok: true })
  }))

  router.get('/api/admin/seo/robots', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    res.json({ robots: ctx.settings.robots })
  }))

  router.put('/api/admin/seo/robots', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ robots: z.string() }).parse(req.body)
    const settings = await saveSettings(deps.prisma, { robots: body.robots }, deps.env.META_REDIRECT_URI)
    res.json({ robots: settings.robots })
  }))

  router.get('/api/admin/seo/redirects', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const page = readPage(req.query)
    const [total, redirects] = await Promise.all([
      deps.prisma.seoRedirect.count(),
      deps.prisma.seoRedirect.findMany({ orderBy: { fromPath: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ redirects, ...pageBody(page, total) })
  }))

  router.post('/api/admin/seo/redirects', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ fromPath: z.string().min(1), toPath: z.string().min(1), statusCode: z.number().int().default(301) }).parse(req.body)
    const redirect = await deps.prisma.seoRedirect.create({ data: body })
    res.status(201).json({ redirect })
  }))

  router.patch('/api/admin/seo/redirects/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const existing = await deps.prisma.seoRedirect.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound()
    const body = z.object({
      fromPath: z.string().min(1).optional(),
      toPath: z.string().min(1).optional(),
      statusCode: z.number().int().optional(),
    }).parse(req.body)
    const redirect = await deps.prisma.seoRedirect.update({ where: { id: existing.id }, data: body })
    res.json({ redirect })
  }))

  router.delete('/api/admin/seo/redirects/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    await deps.prisma.seoRedirect.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }))

  router.get('/api/admin/seo/sets', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const page = readPage(req.query)
    const [total, sets] = await Promise.all([
      deps.prisma.seoSet.count(),
      deps.prisma.seoSet.findMany({ orderBy: { name: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({ sets, ...pageBody(page, total) })
  }))

  router.post('/api/admin/seo/sets', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      name: z.string().min(1),
      category: z.string().min(1),
      keywords: z.array(z.string()).default([]),
      hashtags: z.array(z.string()).max(10).default([]),
    }).parse(req.body)
    const set = await deps.prisma.seoSet.create({ data: body })
    res.status(201).json({ set })
  }))

  router.patch('/api/admin/seo/sets/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      name: z.string().optional(),
      category: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).max(10).optional(),
    }).parse(req.body)
    const set = await deps.prisma.seoSet.update({ where: { id: req.params.id }, data: body })
    res.json({ set })
  }))

  router.delete('/api/admin/seo/sets/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    await deps.prisma.seoSet.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }))

  router.get('/api/admin/audit', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const page = readPage(req.query)
    const [total, logs] = await Promise.all([
      deps.prisma.auditLog.count(),
      deps.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, ...pageArgs(page) }),
    ])
    res.json({ logs, ...pageBody(page, total) })
  }))

  router.get('/api/admin/staff', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const page = readPage(req.query)
    const [total, staff] = await Promise.all([
      deps.prisma.staffUser.count(),
      deps.prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' }, ...pageArgs(page) }),
    ])
    res.json({
      staff: staff.map((person) => ({ id: person.id, email: person.email, name: person.name, role: person.role })),
      ...pageBody(page, total),
    })
  }))

  router.post('/api/admin/staff', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      email: z.string().email(),
      name: z.string().min(1),
      password: z.string().min(8),
      role: z.enum(['SUPER_ADMIN', 'SUPPORT']),
    }).parse(req.body)
    const staff = await deps.prisma.staffUser.create({
      data: { email: body.email.toLowerCase(), name: body.name, role: body.role, passwordHash: await hashPassword(body.password) },
    })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'staff.created', targetId: staff.id, metadata: { role: staff.role } })
    res.status(201).json({ staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role } })
  }))

  router.patch('/api/admin/staff/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({
      name: z.string().min(1).max(120).optional(),
      role: z.enum(['SUPER_ADMIN', 'SUPPORT']).optional(),
    }).parse(req.body)
    const person = await deps.prisma.staffUser.findUnique({ where: { id: req.params.id } })
    if (!person) throw notFound()
    if (body.role && person.id === ctx.staff.id && body.role !== person.role) {
      throw new ApiError(409, 'validation', 'You cannot change your own staff role')
    }
    const updated = await deps.prisma.staffUser.update({ where: { id: person.id }, data: body })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'staff.updated', targetId: person.id, metadata: { role: updated.role } })
    res.json({ staff: { id: updated.id, email: updated.email, name: updated.name, role: updated.role } })
  }))

  router.delete('/api/admin/staff/:id', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    if (req.params.id === ctx.staff.id) throw new ApiError(409, 'validation', 'You cannot delete your own staff account')
    const person = await deps.prisma.staffUser.findUnique({ where: { id: req.params.id } })
    if (!person) throw notFound()
    await deps.prisma.session.deleteMany({ where: { staffUserId: person.id } })
    await deps.prisma.staffUser.delete({ where: { id: person.id } })
    await audit(deps.prisma, { actorType: 'staff', actorId: ctx.staff.id, action: 'staff.deleted', targetId: person.id })
    res.json({ ok: true })
  }))

  return router
}

function publicSettings(settings: SiteSettings) {
  return {
    ...settings,
    platformKeySet: undefined,
  }
}

function pagedMembers<T>(rows: T[], page: number) {
  const paged = slicePage(rows, page)
  return { members: paged.items, membersPage: paged.page, membersPageSize: paged.pageSize, membersTotal: paged.total }
}

function pagedAccounts<T>(rows: T[], page: number) {
  const paged = slicePage(rows, page)
  return { instagramAccounts: paged.items, accountsPage: paged.page, accountsPageSize: paged.pageSize, accountsTotal: paged.total }
}

function assertNoSecrets(value: unknown): void {
  const json = JSON.stringify(value)
  for (const key of SECRET_KEYS) {
    if (json.includes(`"${key}"`)) throw new ApiError(500, 'internal', 'A staff response included a secret field')
  }
}
