import { Router } from 'express'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'
import { hashPassword } from '../crypto'
import { asyncRoute } from '../http'
import { audit } from '../audit'
import { requireStaff, requireStaffRole } from '../services/context'
import { saveSettings, type SiteSettings } from '../settings'
import { presentAccount } from '../services/instagram'

const SECRET_KEYS = ['accessToken', 'accessTokenEnc', 'providerKey', 'providerKeyEnc', 'password', 'passwordHash', 'token', 'appSecret']

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
    const organizations = await deps.prisma.organization.findMany({
      where: q ? { name: { contains: q } } : {},
      include: { subscription: true },
      take: 100,
      orderBy: { createdAt: 'desc' },
    })
    res.json({
      organizations: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        suspended: org.suspended,
        packageId: org.subscription?.packageId,
        status: org.subscription?.status,
      })),
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
      members: org.memberships.map((member) => ({
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        role: member.role,
        disabled: member.user.disabled,
      })),
      instagramAccounts: org.instagramAccounts.map(presentAccount),
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

  router.get('/api/admin/users', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const q = typeof req.query.q === 'string' ? req.query.q : ''
    const users = await deps.prisma.user.findMany({
      where: q ? { email: { contains: q } } : {},
      take: 100,
      orderBy: { createdAt: 'desc' },
    })
    res.json({ users: users.map((user) => ({ id: user.id, email: user.email, name: user.name, disabled: user.disabled })) })
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

  router.get('/api/admin/packages', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const packages = await deps.prisma.package.findMany({ orderBy: { sortOrder: 'asc' } })
    res.json({ packages })
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

  router.get('/api/admin/subscriptions', asyncRoute(async (req, res) => {
    await requireStaff(deps, req)
    const subscriptions = await deps.prisma.subscription.findMany({ include: { package: true }, take: 100 })
    res.json({
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        organizationId: subscription.organizationId,
        packageId: subscription.packageId,
        status: subscription.status,
        seats: subscription.seatsOverride ?? subscription.package.seats,
        currentPeriodEnd: subscription.currentPeriodEnd,
      })),
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
    res.json({
      usage: grouped.map((row) => ({ organizationId: row.organizationId, kind: row.kind, count: row._count._all })),
    })
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
    res.json({ pages: await deps.prisma.publicPage.findMany({ orderBy: { path: 'asc' } }) })
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
    res.json({ redirects: await deps.prisma.seoRedirect.findMany() })
  }))

  router.post('/api/admin/seo/redirects', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const body = z.object({ fromPath: z.string().min(1), toPath: z.string().min(1), statusCode: z.number().int().default(301) }).parse(req.body)
    const redirect = await deps.prisma.seoRedirect.create({ data: body })
    res.status(201).json({ redirect })
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
    res.json({ sets: await deps.prisma.seoSet.findMany() })
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
    const logs = await deps.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    res.json({ logs })
  }))

  router.get('/api/admin/staff', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    requireStaffRole(ctx, 'SUPER_ADMIN')
    const staff = await deps.prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } })
    res.json({ staff: staff.map((person) => ({ id: person.id, email: person.email, name: person.name, role: person.role })) })
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

  return router
}

function publicSettings(settings: SiteSettings) {
  return {
    ...settings,
    platformKeySet: undefined,
  }
}

function assertNoSecrets(value: unknown): void {
  const json = JSON.stringify(value)
  for (const key of SECRET_KEYS) {
    if (json.includes(`"${key}"`)) throw new ApiError(500, 'internal', 'A staff response included a secret field')
  }
}
