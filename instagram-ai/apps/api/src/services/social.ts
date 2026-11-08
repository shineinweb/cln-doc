import { NETWORK_LABEL, isSocialNetwork, type SocialNetwork } from '@instagram-ai/shared'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { encryptString, newSecret } from '../crypto'
import { readOauthApp } from '../settings'
import type { CustomerContext } from './context'
import { startInstagramConnect } from './instagram'

const CONNECTED = ['connected', 'expired']

export function presentSocialAccount(account: {
  id: string
  network: string
  externalId: string
  displayName: string
  username: string
  status: string
  lastError: string | null
  tokenExpiresAt: Date | null
  scopes: string
  instagramAccountId: string | null
}) {
  return {
    id: account.id,
    network: account.network,
    externalId: account.externalId,
    displayName: account.displayName,
    username: account.username,
    status: account.status,
    lastError: account.lastError,
    tokenExpiresAt: account.tokenExpiresAt,
    scopes: account.scopes,
    instagramAccountId: account.instagramAccountId,
  }
}

export async function mirrorInstagramAccounts(deps: Deps, organizationId: string): Promise<void> {
  const accounts = await deps.prisma.instagramAccount.findMany({
    where: { organizationId },
    include: { credential: true },
  })
  for (const account of accounts) {
    const existing = await deps.prisma.socialAccount.findUnique({ where: { instagramAccountId: account.id } })
    if (account.status === 'disconnected') {
      if (existing) {
        await deps.prisma.socialCredential.deleteMany({ where: { socialAccountId: existing.id } })
        await deps.prisma.socialAccount.update({
          where: { id: existing.id },
          data: { status: 'disconnected', lastError: null },
        })
      }
      continue
    }
    if (!account.credential) continue
    const social = existing
      ? await deps.prisma.socialAccount.update({
          where: { id: existing.id },
          data: {
            externalId: account.igUserId,
            displayName: account.username,
            username: account.username,
            status: account.status,
            lastError: account.lastError,
            tokenExpiresAt: account.tokenExpiresAt,
            scopes: account.scopes,
          },
        })
      : await deps.prisma.socialAccount.create({
          data: {
            organizationId,
            network: 'instagram',
            externalId: account.igUserId,
            displayName: account.username,
            username: account.username,
            status: account.status,
            lastError: account.lastError,
            tokenExpiresAt: account.tokenExpiresAt,
            scopes: account.scopes,
            instagramAccountId: account.id,
          },
        })
    await deps.prisma.socialCredential.upsert({
      where: { socialAccountId: social.id },
      create: {
        organizationId,
        socialAccountId: social.id,
        accessTokenEnc: account.credential.accessTokenEnc,
        expiresAt: account.credential.expiresAt,
      },
      update: {
        accessTokenEnc: account.credential.accessTokenEnc,
        expiresAt: account.credential.expiresAt,
      },
    })
  }
}

export async function listSocialAccounts(deps: Deps, organizationId: string) {
  await mirrorInstagramAccounts(deps, organizationId)
  const accounts = await deps.prisma.socialAccount.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  })
  return accounts.map(presentSocialAccount)
}

function redirectFor(deps: Deps, network: SocialNetwork): string {
  if (network === 'instagram') return deps.env.META_REDIRECT_URI
  return `${deps.env.WEB_ORIGIN}/api/integrations/${network}/callback`
}

export async function startSocialConnect(deps: Deps, ctx: CustomerContext, network: string, reconnectId?: string, origin?: string): Promise<string> {
  if (!isSocialNetwork(network)) throw new ApiError(400, 'validation', 'That network is not available')
  if (network === 'instagram') return startInstagramConnect(deps, ctx, reconnectId, origin)
  const app = await readOauthApp(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY, network)
  if (!app) {
    throw new ApiError(400, 'validation', `Add the ${NETWORK_LABEL[network]} client id and secret in admin settings`)
  }
  if (reconnectId) {
    const existing = await deps.prisma.socialAccount.findFirst({
      where: { id: reconnectId, organizationId: ctx.organization.id, network },
    })
    if (!existing) throw new ApiError(404, 'not_found', 'Account not found')
  } else {
    const count = await deps.prisma.socialAccount.count({
      where: { organizationId: ctx.organization.id, network, status: { in: CONNECTED } },
    })
    if (count >= ctx.subscription.package.instagramAccounts) {
      throw new ApiError(403, 'entitlement', `The package account limit is already reached for ${NETWORK_LABEL[network]}`)
    }
  }
  const state = newSecret(24)
  await deps.prisma.oauthState.create({
    data: {
      state,
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      network,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  })
  return deps.networks.buildAuthorizeUrl({ network, app, redirectUri: redirectFor(deps, network), state })
}

export async function finishSocialConnect(deps: Deps, network: string, code: string, state: string): Promise<{ organizationId: string }> {
  if (!isSocialNetwork(network) || network === 'instagram') {
    throw new ApiError(400, 'validation', 'That network is not available')
  }
  const saved = await deps.prisma.oauthState.findUnique({ where: { state } })
  if (!saved || saved.expiresAt.getTime() < Date.now() || saved.network !== network) {
    throw new ApiError(400, 'validation', 'The login state is invalid')
  }
  await deps.prisma.oauthState.delete({ where: { state } })
  const app = await readOauthApp(deps.prisma, deps.env.TOKEN_ENCRYPTION_KEY, network)
  if (!app) throw new ApiError(400, 'validation', `Add the ${NETWORK_LABEL[network]} client id and secret in admin settings`)
  const profile = await deps.networks.exchangeCode({
    network,
    app,
    redirectUri: redirectFor(deps, network),
    code,
  })
  const existing = await deps.prisma.socialAccount.findUnique({
    where: {
      organizationId_network_externalId: {
        organizationId: saved.organizationId,
        network,
        externalId: profile.externalId,
      },
    },
  })
  if (!existing) {
    const subscription = await deps.prisma.subscription.findUnique({
      where: { organizationId: saved.organizationId },
      include: { package: true },
    })
    const count = await deps.prisma.socialAccount.count({
      where: { organizationId: saved.organizationId, network, status: { in: CONNECTED } },
    })
    if (!subscription || count >= subscription.package.instagramAccounts) {
      throw new ApiError(403, 'entitlement', `The package account limit is already reached for ${NETWORK_LABEL[network]}`)
    }
  }
  const expiresAt = new Date(Date.now() + profile.expiresInSec * 1000)
  const account = existing
    ? await deps.prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          displayName: profile.displayName,
          username: profile.username,
          status: 'connected',
          lastError: null,
          tokenExpiresAt: expiresAt,
          scopes: profile.scopes,
        },
      })
    : await deps.prisma.socialAccount.create({
        data: {
          organizationId: saved.organizationId,
          network,
          externalId: profile.externalId,
          displayName: profile.displayName,
          username: profile.username,
          status: 'connected',
          tokenExpiresAt: expiresAt,
          scopes: profile.scopes,
        },
      })
  const accessTokenEnc = encryptString(profile.accessToken, deps.env.TOKEN_ENCRYPTION_KEY)
  const refreshTokenEnc = profile.refreshToken ? encryptString(profile.refreshToken, deps.env.TOKEN_ENCRYPTION_KEY) : null
  await deps.prisma.socialCredential.upsert({
    where: { socialAccountId: account.id },
    create: { organizationId: saved.organizationId, socialAccountId: account.id, accessTokenEnc, refreshTokenEnc, expiresAt },
    update: { accessTokenEnc, refreshTokenEnc, expiresAt },
  })
  return { organizationId: saved.organizationId }
}

export async function disconnectSocial(deps: Deps, organizationId: string, accountId: string): Promise<void> {
  const account = await deps.prisma.socialAccount.findFirst({ where: { id: accountId, organizationId } })
  if (!account) throw new ApiError(404, 'not_found', 'Account not found')
  await deps.prisma.socialCredential.deleteMany({ where: { socialAccountId: account.id } })
  await deps.prisma.socialAccount.update({
    where: { id: account.id },
    data: { status: 'disconnected', lastError: null },
  })
  if (account.instagramAccountId) {
    await deps.prisma.oauthCredential.deleteMany({ where: { instagramAccountId: account.instagramAccountId } })
    await deps.prisma.instagramAccount.update({
      where: { id: account.instagramAccountId },
      data: { status: 'disconnected', lastError: null },
    })
  }
}

export async function replaceTargets(deps: Deps, organizationId: string, postId: string, socialAccountIds: string[]): Promise<string | null> {
  const unique = [...new Set(socialAccountIds)]
  const accounts = unique.length
    ? await deps.prisma.socialAccount.findMany({
        where: { id: { in: unique }, organizationId, status: 'connected' },
      })
    : []
  if (accounts.length !== unique.length) throw new ApiError(400, 'validation', 'Choose a connected account')
  await deps.prisma.postTarget.deleteMany({
    where: {
      postId,
      status: { not: 'PUBLISHED' },
      ...(unique.length ? { socialAccountId: { notIn: unique } } : {}),
    },
  })
  for (const account of accounts) {
    await deps.prisma.postTarget.upsert({
      where: { postId_socialAccountId: { postId, socialAccountId: account.id } },
      create: { postId, socialAccountId: account.id, status: 'DRAFT' },
      update: {},
    })
  }
  return accounts.find((account) => account.network === 'instagram')?.instagramAccountId ?? null
}
