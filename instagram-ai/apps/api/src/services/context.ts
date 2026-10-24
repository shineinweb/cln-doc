import type { Package, Subscription } from '@prisma/client'
import {
  roleHas,
  subscriptionAllowsWrites,
  type OrgRole,
  type Permission,
  type StaffRole,
} from '@instagram-ai/shared'
import type { Request } from 'express'
import { CUSTOMER_COOKIE, STAFF_COOKIE } from '@instagram-ai/shared'
import type { Deps } from '../deps'
import { ApiError, forbidden } from '../errors'
import { safeEqual, sha256 } from '../crypto'
import { readCookie } from '../http'
import { loadSettings, type SiteSettings } from '../settings'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_EXEMPT = new Set([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/admin/auth/login',
  '/api/invitations/accept',
  '/api/webhooks/stripe',
  '/api/webhooks/instagram',
])

export type CustomerContext = {
  user: { id: string; email: string; name: string }
  organization: { id: string; name: string; slug: string; suspended: boolean; timezone: string }
  membership: { id: string; role: OrgRole }
  subscription: Subscription & { package: Package }
  settings: SiteSettings
}

export type StaffContext = {
  staff: { id: string; email: string; name: string; role: StaffRole }
  settings: SiteSettings
}

function assertCsrf(req: Request, secret: string): void {
  const path = req.originalUrl.split('?')[0]
  if (SAFE.has(req.method) || CSRF_EXEMPT.has(path)) return
  const header = req.header('x-csrf-token') ?? ''
  if (!safeEqual(header, secret)) throw new ApiError(403, 'csrf', 'The security token is missing or expired')
}

export async function requireCustomer(deps: Deps, req: Request): Promise<CustomerContext> {
  const raw = readCookie(req.headers.cookie, CUSTOMER_COOKIE)
  if (!raw) throw new ApiError(401, 'unauthorized', 'Sign in to continue')
  const session = await deps.prisma.session.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } })
  if (!session || session.kind !== 'CUSTOMER' || !session.user || session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'unauthorized', 'Sign in to continue')
  }
  if (session.user.disabled) throw new ApiError(403, 'forbidden', 'This account is disabled')
  assertCsrf(req, session.csrfSecret)
  const memberships = await deps.prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { organization: true },
  })
  const requested = req.header('x-organization-id')
  const membership = requested
    ? memberships.find((item) => item.organizationId === requested)
    : memberships.length === 1
      ? memberships[0]
      : undefined
  if (requested && !membership) throw forbidden('You are not a member of that organization')
  if (!membership) throw new ApiError(400, 'validation', 'Choose an organization')
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: membership.organizationId },
    include: { package: true },
  })
  if (!subscription) throw new ApiError(500, 'internal', 'This organization has no subscription')
  return {
    user: { id: session.user.id, email: session.user.email, name: session.user.name },
    organization: membership.organization,
    membership: { id: membership.id, role: membership.role },
    subscription,
    settings: await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI),
  }
}

export async function requireStaff(deps: Deps, req: Request): Promise<StaffContext> {
  const raw = readCookie(req.headers.cookie, STAFF_COOKIE)
  if (!raw) throw new ApiError(401, 'unauthorized', 'Sign in to the admin panel')
  const session = await deps.prisma.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { staffUser: true },
  })
  if (!session || session.kind !== 'STAFF' || !session.staffUser || session.expiresAt.getTime() < Date.now()) {
    throw new ApiError(401, 'unauthorized', 'Sign in to the admin panel')
  }
  assertCsrf(req, session.csrfSecret)
  return {
    staff: {
      id: session.staffUser.id,
      email: session.staffUser.email,
      name: session.staffUser.name,
      role: session.staffUser.role,
    },
    settings: await loadSettings(deps.prisma, deps.env.META_REDIRECT_URI),
  }
}

export function requirePermission(ctx: CustomerContext, permission: Permission): void {
  if (!roleHas(ctx.membership.role, permission)) throw forbidden()
}

export function requireWritable(ctx: CustomerContext): void {
  if (!subscriptionAllowsWrites(ctx.subscription.status, ctx.organization.suspended)) {
    throw new ApiError(403, 'subscription_inactive', 'This subscription cannot start new publishes, sends, or generations')
  }
}

export function requireStaffRole(ctx: StaffContext, role: StaffRole): void {
  if (ctx.staff.role !== role) throw forbidden('Only a super admin can do that')
}

export async function assertQuota(
  deps: Deps,
  ctx: CustomerContext,
  kind: 'text' | 'image' | 'video',
  need = 1,
): Promise<void> {
  const limit =
    kind === 'text'
      ? ctx.subscription.package.monthlyAiGenerations
      : kind === 'image'
        ? ctx.subscription.package.monthlyImageGenerations
        : ctx.subscription.package.monthlyVideoGenerations
  const used = await deps.prisma.aiUsage.count({
    where: {
      organizationId: ctx.organization.id,
      kind,
      createdAt: { gte: ctx.subscription.currentPeriodStart, lt: ctx.subscription.currentPeriodEnd },
    },
  })
  if (used + need > limit) {
    throw new ApiError(403, 'quota_exceeded', `The monthly ${kind} quota is used up`)
  }
}

export async function seatLimitReached(deps: Deps, ctx: CustomerContext): Promise<boolean> {
  const seats = ctx.subscription.seatsOverride ?? ctx.subscription.package.seats
  const members = await deps.prisma.membership.count({ where: { organizationId: ctx.organization.id } })
  const pending = await deps.prisma.invitation.count({
    where: { organizationId: ctx.organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  return members + pending >= seats
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}
