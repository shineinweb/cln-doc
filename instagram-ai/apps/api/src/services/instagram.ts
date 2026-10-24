import { IG_SCOPES } from '@instagram-ai/shared'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { decryptString, encryptString, newSecret } from '../crypto'
import type { CustomerContext } from './context'

export function presentAccount(account: {
  id: string
  igUserId: string
  username: string
  accountType: string
  status: string
  lastError: string | null
  tokenExpiresAt: Date | null
  timezone: string
  scopes: string
}) {
  return {
    id: account.id,
    igUserId: account.igUserId,
    username: account.username,
    accountType: account.accountType,
    status: account.status,
    lastError: account.lastError,
    tokenExpiresAt: account.tokenExpiresAt,
    timezone: account.timezone,
    scopes: account.scopes,
  }
}

export async function connectedCount(deps: Deps, organizationId: string): Promise<number> {
  return deps.prisma.instagramAccount.count({
    where: { organizationId, status: { in: ['connected', 'expired'] } },
  })
}

export async function startInstagramConnect(deps: Deps, ctx: CustomerContext, reconnectId?: string): Promise<string> {
  if (reconnectId) {
    const existing = await deps.prisma.instagramAccount.findFirst({
      where: { id: reconnectId, organizationId: ctx.organization.id },
    })
    if (!existing) throw new ApiError(404, 'not_found', 'Instagram account not found')
  } else if ((await connectedCount(deps, ctx.organization.id)) >= ctx.subscription.package.instagramAccounts) {
    throw new ApiError(403, 'entitlement', 'The package Instagram account limit is already reached')
  }
  const state = newSecret(24)
  await deps.prisma.oauthState.create({
    data: {
      state,
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  })
  return deps.meta.buildAuthorizeUrl(state)
}

export async function finishInstagramConnect(deps: Deps, code: string, state: string): Promise<{ organizationId: string }> {
  const saved = await deps.prisma.oauthState.findUnique({ where: { state } })
  if (!saved || saved.expiresAt.getTime() < Date.now()) throw new ApiError(400, 'validation', 'The Instagram login state is invalid')
  await deps.prisma.oauthState.delete({ where: { state } })
  const token = await deps.meta.exchangeCode(code)
  const existing = await deps.prisma.instagramAccount.findUnique({
    where: { organizationId_igUserId: { organizationId: saved.organizationId, igUserId: token.profile.igUserId } },
  })
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: saved.organizationId },
    include: { package: true },
  })
  if (!subscription) throw new ApiError(400, 'validation', 'Organization not found')
  if (!existing) {
    const count = await connectedCount(deps, saved.organizationId)
    if (count >= subscription.package.instagramAccounts) {
      throw new ApiError(403, 'entitlement', 'The package Instagram account limit is already reached')
    }
  }
  const expiresAt = new Date(Date.now() + token.expiresInSec * 1000)
  const account = existing
    ? await deps.prisma.instagramAccount.update({
        where: { id: existing.id },
        data: {
          username: token.profile.username,
          accountType: token.profile.accountType,
          status: 'connected',
          lastError: null,
          tokenExpiresAt: expiresAt,
          scopes: token.profile.scopes || IG_SCOPES.join(','),
        },
      })
    : await deps.prisma.instagramAccount.create({
        data: {
          organizationId: saved.organizationId,
          igUserId: token.profile.igUserId,
          username: token.profile.username,
          accountType: token.profile.accountType,
          status: 'connected',
          tokenExpiresAt: expiresAt,
          scopes: token.profile.scopes || IG_SCOPES.join(','),
        },
      })
  const accessTokenEnc = encryptString(token.accessToken, deps.env.TOKEN_ENCRYPTION_KEY)
  await deps.prisma.oauthCredential.upsert({
    where: { instagramAccountId: account.id },
    create: { organizationId: saved.organizationId, instagramAccountId: account.id, accessTokenEnc, expiresAt },
    update: { accessTokenEnc, expiresAt },
  })
  return { organizationId: saved.organizationId }
}

export async function disconnectInstagram(deps: Deps, organizationId: string, accountId: string): Promise<void> {
  const account = await deps.prisma.instagramAccount.findFirst({ where: { id: accountId, organizationId } })
  if (!account) throw new ApiError(404, 'not_found', 'Instagram account not found')
  await deps.prisma.oauthCredential.deleteMany({ where: { instagramAccountId: account.id } })
  await deps.prisma.instagramAccount.update({
    where: { id: account.id },
    data: { status: 'disconnected', lastError: null },
  })
}

export async function usableToken(
  deps: Deps,
  organizationId: string,
  accountId: string,
): Promise<{ accountId: string; igUserId: string; username: string; scopes: string; token: string; timezone: string }> {
  const account = await deps.prisma.instagramAccount.findFirst({
    where: { id: accountId, organizationId },
    include: { credential: true },
  })
  if (!account || account.status === 'disconnected' || !account.credential) {
    throw new ApiError(409, 'reconnect_required', 'Reconnect the Instagram account before continuing')
  }
  let token = decryptString(account.credential.accessTokenEnc, deps.env.TOKEN_ENCRYPTION_KEY)
  const expired = account.status === 'expired' || (account.tokenExpiresAt !== null && account.tokenExpiresAt.getTime() <= Date.now())
  if (expired) {
    try {
      const refreshed = await deps.meta.refreshToken(token)
      token = refreshed.accessToken
      const expiresAt = new Date(Date.now() + refreshed.expiresInSec * 1000)
      await deps.prisma.oauthCredential.update({
        where: { instagramAccountId: account.id },
        data: { accessTokenEnc: encryptString(token, deps.env.TOKEN_ENCRYPTION_KEY), expiresAt },
      })
      await deps.prisma.instagramAccount.update({
        where: { id: account.id },
        data: { status: 'connected', tokenExpiresAt: expiresAt, lastError: null },
      })
    } catch {
      await deps.prisma.instagramAccount.update({
        where: { id: account.id },
        data: { status: 'expired', lastError: 'Reconnect the Instagram account' },
      })
      throw new ApiError(409, 'reconnect_required', 'Reconnect the Instagram account before continuing')
    }
  }
  return {
    accountId: account.id,
    igUserId: account.igUserId,
    username: account.username,
    scopes: account.scopes,
    token,
    timezone: account.timezone,
  }
}
