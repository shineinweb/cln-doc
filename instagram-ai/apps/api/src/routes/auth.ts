import { CUSTOMER_COOKIE, STAFF_COOKIE } from '@instagram-ai/shared'
import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { hashPassword, newSecret, sha256, verifyPassword } from '../crypto'
import { asyncRoute, clientIp, sessionCookie } from '../http'
import { hitLimit } from '../rate-limit'
import { audit } from '../audit'
import { registrationOpen } from '../settings'
import { loadSettings } from '../settings'
import { requireCustomer, requireStaff } from '../services/context'

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
})

async function openSession(deps: Deps, kind: 'CUSTOMER' | 'STAFF', ids: { userId?: string; staffUserId?: string }) {
  const raw = newSecret()
  const csrfSecret = newSecret(24)
  await deps.prisma.session.create({
    data: {
      tokenHash: sha256(raw),
      kind,
      csrfSecret,
      userId: ids.userId,
      staffUserId: ids.staffUserId,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })
  return { raw, csrfSecret }
}

function setSession(deps: Deps, name: string, raw: string) {
  return sessionCookie(name, raw, 14 * 24 * 60 * 60, deps.env.NODE_ENV === 'production')
}

export function authRoutes(deps: Deps): Router {
  const router = Router()

  router.post('/api/auth/register', asyncRoute(async (req, res) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8).max(200),
      name: z.string().min(1).max(120),
      organizationName: z.string().min(1).max(120),
    }).parse(req.body)
    const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
    if (!registrationOpen(settings)) throw new ApiError(403, 'forbidden', 'Registration is closed')
    const email = body.email.toLowerCase()
    if (await deps.prisma.user.findUnique({ where: { email } })) {
      throw new ApiError(409, 'validation', 'An account with that email already exists')
    }
    const periodStart = new Date()
    const periodEnd = new Date(periodStart.getTime() + 14 * 24 * 60 * 60 * 1000)
    const slug = `${body.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org'}-${newSecret(3).toLowerCase()}`
    const created = await deps.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: body.name, passwordHash: await hashPassword(body.password) },
      })
      const organization = await tx.organization.create({ data: { name: body.organizationName, slug } })
      await tx.membership.create({ data: { organizationId: organization.id, userId: user.id, role: 'OWNER' } })
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          packageId: 'starter',
          status: 'trialing',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          provider: 'trial',
        },
      })
      await tx.brandProfile.create({
        data: {
          organizationId: organization.id,
          brandName: body.organizationName,
          businessDescription: '',
          targetAudience: '',
          voiceAndTone: '',
          productsAndServices: '',
          approvedFacts: [],
          topicsToAvoid: '',
        },
      })
      await tx.aiProfile.create({ data: { organizationId: organization.id, extraInstructions: '' } })
      return { user, organization }
    })
    const session = await openSession(deps, 'CUSTOMER', { userId: created.user.id })
    res.append('Set-Cookie', setSession(deps, CUSTOMER_COOKIE, session.raw))
    res.status(201).json({
      user: { id: created.user.id, email: created.user.email, name: created.user.name },
      organization: { id: created.organization.id, name: created.organization.name },
      csrfToken: session.csrfSecret,
    })
  }))

  router.post('/api/auth/login', asyncRoute(async (req, res) => {
    const body = credentials.parse(req.body)
    const email = body.email.toLowerCase()
    if (!hitLimit(`login:${email}:${clientIp(req)}`, deps.env.LOGIN_RATE_LIMIT, deps.env.LOGIN_RATE_WINDOW_MS)) {
      throw new ApiError(429, 'rate_limited', 'Too many login attempts. Try again later.')
    }
    const user = await deps.prisma.user.findUnique({ where: { email } })
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, 'unauthorized', 'Email or password is wrong')
    }
    if (user.disabled) throw new ApiError(403, 'forbidden', 'This account is disabled')
    const session = await openSession(deps, 'CUSTOMER', { userId: user.id })
    const memberships = await deps.prisma.membership.findMany({ where: { userId: user.id }, include: { organization: true } })
    res.append('Set-Cookie', setSession(deps, CUSTOMER_COOKIE, session.raw))
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      organizations: memberships.map((item) => ({ id: item.organization.id, name: item.organization.name, role: item.role })),
      csrfToken: session.csrfSecret,
    })
  }))

  router.post('/api/auth/logout', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    const raw = req.headers.cookie ?? ''
    void ctx
    const token = raw.match(new RegExp(`${CUSTOMER_COOKIE}=([^;]+)`))?.[1]
    if (token) await deps.prisma.session.deleteMany({ where: { tokenHash: sha256(decodeURIComponent(token)) } })
    res.append('Set-Cookie', sessionCookie(CUSTOMER_COOKIE, '', 0, deps.env.NODE_ENV === 'production'))
    res.json({ ok: true })
  }))

  router.get('/api/auth/me', asyncRoute(async (req, res) => {
    const ctx = await requireCustomer(deps, req)
    const memberships = await deps.prisma.membership.findMany({
      where: { userId: ctx.user.id },
      include: { organization: true },
    })
    res.json({
      user: ctx.user,
      organization: { id: ctx.organization.id, name: ctx.organization.name, role: ctx.membership.role },
      organizations: memberships.map((item) => ({ id: item.organization.id, name: item.organization.name, role: item.role })),
    })
  }))

  router.get('/api/csrf', asyncRoute(async (req, res) => {
    const raw = req.headers.cookie?.match(new RegExp(`${CUSTOMER_COOKIE}=([^;]+)`))?.[1]
    if (!raw) throw new ApiError(401, 'unauthorized', 'Sign in to continue')
    const session = await deps.prisma.session.findUnique({ where: { tokenHash: sha256(decodeURIComponent(raw)) } })
    if (!session || session.kind !== 'CUSTOMER') throw new ApiError(401, 'unauthorized', 'Sign in to continue')
    res.json({ csrfToken: session.csrfSecret })
  }))

  router.post('/api/auth/forgot-password', asyncRoute(async (req, res) => {
    const body = z.object({ email: z.string().email() }).parse(req.body)
    const user = await deps.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } })
    let resetToken: string | undefined
    if (user) {
      resetToken = newSecret()
      await deps.prisma.passwordReset.create({
        data: { userId: user.id, tokenHash: sha256(resetToken), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
      })
      const settings = await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI)
      deps.logger.info({ template: settings.email.resetTemplate, userId: user.id }, 'password reset requested')
    }
    res.json({ ok: true, ...(deps.env.EXPOSE_DEV_TOKENS && resetToken ? { resetToken } : {}) })
  }))

  router.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
    const body = z.object({ token: z.string().min(10), password: z.string().min(8).max(200) }).parse(req.body)
    const reset = await deps.prisma.passwordReset.findUnique({ where: { tokenHash: sha256(body.token) } })
    if (!reset || reset.usedAt || reset.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'validation', 'This reset link is invalid')
    }
    await deps.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await hashPassword(body.password) } })
    await deps.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } })
    await deps.prisma.session.deleteMany({ where: { userId: reset.userId } })
    res.json({ ok: true })
  }))

  router.post('/api/invitations/accept', asyncRoute(async (req, res) => {
    const body = z.object({
      token: z.string().min(10),
      name: z.string().min(1).max(120).optional(),
      password: z.string().min(8).max(200).optional(),
    }).parse(req.body)
    const invitation = await deps.prisma.invitation.findUnique({ where: { tokenHash: sha256(body.token) } })
    if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() < Date.now()) {
      throw new ApiError(400, 'validation', 'This invitation is invalid')
    }
    let user = await deps.prisma.user.findUnique({ where: { email: invitation.email } })
    if (!user) {
      if (!body.name || !body.password) throw new ApiError(400, 'validation', 'Name and password are required')
      user = await deps.prisma.user.create({
        data: { email: invitation.email, name: body.name, passwordHash: await hashPassword(body.password) },
      })
    } else if (body.password && !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, 'unauthorized', 'Email or password is wrong')
    }
    const existing = await deps.prisma.membership.findUnique({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } },
    })
    if (!existing) {
      const subscription = await deps.prisma.subscription.findUnique({
        where: { organizationId: invitation.organizationId },
        include: { package: true },
      })
      const members = await deps.prisma.membership.count({ where: { organizationId: invitation.organizationId } })
      const seats = subscription?.seatsOverride ?? subscription?.package.seats ?? 0
      if (members >= seats) throw new ApiError(403, 'entitlement', 'The seat limit is already reached')
      await deps.prisma.membership.create({
        data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role },
      })
    }
    await deps.prisma.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })
    await audit(deps.prisma, {
      organizationId: invitation.organizationId,
      actorType: 'user',
      actorId: user.id,
      action: 'invitation.accepted',
      targetId: invitation.id,
    })
    const session = await openSession(deps, 'CUSTOMER', { userId: user.id })
    res.append('Set-Cookie', setSession(deps, CUSTOMER_COOKIE, session.raw))
    res.json({ ok: true, organizationId: invitation.organizationId, csrfToken: session.csrfSecret })
  }))

  router.post('/api/admin/auth/login', asyncRoute(async (req, res) => {
    const body = credentials.parse(req.body)
    const email = body.email.toLowerCase()
    if (!hitLimit(`staff:${email}:${clientIp(req)}`, deps.env.LOGIN_RATE_LIMIT, deps.env.LOGIN_RATE_WINDOW_MS)) {
      throw new ApiError(429, 'rate_limited', 'Too many login attempts. Try again later.')
    }
    const staff = await deps.prisma.staffUser.findUnique({ where: { email } })
    if (!staff || !(await verifyPassword(body.password, staff.passwordHash))) {
      throw new ApiError(401, 'unauthorized', 'Email or password is wrong')
    }
    const session = await openSession(deps, 'STAFF', { staffUserId: staff.id })
    res.append('Set-Cookie', setSession(deps, STAFF_COOKIE, session.raw))
    res.json({ staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role }, csrfToken: session.csrfSecret })
  }))

  router.post('/api/admin/auth/logout', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    await deps.prisma.session.deleteMany({ where: { staffUserId: ctx.staff.id } })
    res.append('Set-Cookie', sessionCookie(STAFF_COOKIE, '', 0, deps.env.NODE_ENV === 'production'))
    res.json({ ok: true })
  }))

  router.get('/api/admin/auth/me', asyncRoute(async (req, res) => {
    const ctx = await requireStaff(deps, req)
    res.json({ staff: ctx.staff })
  }))

  router.get('/api/admin/csrf', asyncRoute(async (req, res) => {
    const raw = req.headers.cookie?.match(new RegExp(`${STAFF_COOKIE}=([^;]+)`))?.[1]
    if (!raw) throw new ApiError(401, 'unauthorized', 'Sign in to the admin panel')
    const session = await deps.prisma.session.findUnique({ where: { tokenHash: sha256(decodeURIComponent(raw)) } })
    if (!session || session.kind !== 'STAFF') throw new ApiError(401, 'unauthorized', 'Sign in to the admin panel')
    res.json({ csrfToken: session.csrfSecret })
  }))

  return router
}
