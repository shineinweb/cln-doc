import {
  claimsBlockPublish,
  composePublishCaption,
  firstCommentAvailable,
  firstCommentUnavailableReason,
  formatRejection,
  parseHashtags,
  type SocialNetwork,
} from '@instagram-ai/shared'
import type { Post, PostTarget, SocialAccount, SocialCredential } from '@prisma/client'
import type { Deps } from '../deps'
import { ApiError } from '../errors'
import { decryptString } from '../crypto'
import { audit } from '../audit'
import { parseClaims } from './content'
import { usableToken } from './instagram'

type TargetRow = PostTarget & { account: SocialAccount & { credential: SocialCredential | null } }

type PostWithTargets = Post & {
  organization: { suspended: boolean }
  media: Array<{ asset: { storageKey: string } }>
  targets: TargetRow[]
}

export async function publishTargets(deps: Deps, post: PostWithTargets): Promise<void> {
  if (post.status === 'PUBLISHED' && post.targets.every((target) => target.status === 'PUBLISHED' || target.status === 'CANCELED')) {
    return
  }
  const subscription = await deps.prisma.subscription.findUnique({
    where: { organizationId: post.organizationId },
    include: { package: true },
  })
  const failPost = async (code: string, message: string): Promise<never> => {
    await deps.prisma.post.update({
      where: { id: post.id },
      data: { status: 'FAILED', publishError: code === 'reconnect_required' ? 'reconnect_required' : message },
    })
    throw new ApiError(code === 'validation' ? 400 : 409, code, message)
  }
  if (!subscription || post.organization.suspended || (subscription.status !== 'trialing' && subscription.status !== 'active')) {
    await failPost('subscription_inactive', 'This subscription cannot start a new publish')
  }
  if (!post.approvedAt) await failPost('approval_required', 'A person has to approve this post before it can publish')
  if (claimsBlockPublish(parseClaims(post.factualClaims))) {
    await failPost('claims_need_review', 'A factual claim still needs a person to accept it')
  }
  if (!post.media.length) await failPost('validation', 'Add a photo or video before publishing')
  await deps.prisma.post.update({
    where: { id: post.id },
    data: { status: 'PUBLISHING', publishError: null },
  })
  const caption = composePublishCaption(post.caption, parseHashtags(post.hashtags))
  const mediaUrls = post.media.map((item) => deps.storage.url(item.asset.storageKey))
  let instagramRemoteId: string | null = post.igMediaId
  for (const target of post.targets) {
    if (target.status === 'CANCELED' || target.status === 'PUBLISHED') {
      await sendTargetFirstComment(deps, post, target)
      continue
    }
    const rejection = formatRejection(target.account.network, post.format)
    if (rejection) {
      await deps.prisma.postTarget.update({
        where: { id: target.id },
        data: {
          status: 'FAILED',
          error: rejection,
          firstCommentError: post.firstComment.trim() ? firstCommentUnavailableReason(target.account.network) : target.firstCommentError,
        },
      })
      continue
    }
    try {
      const accessToken = await tokenFor(deps, post.organizationId, target)
      const result = await deps.networks.publish({
        network: target.account.network as SocialNetwork,
        format: post.format,
        caption,
        mediaUrls,
        accessToken,
        externalId: target.account.externalId,
        containerId: target.containerId,
      })
      if (result.pending) {
        await deps.prisma.postTarget.update({
          where: { id: target.id },
          data: { status: 'PUBLISHING', containerId: result.containerId ?? target.containerId, error: null },
        })
        continue
      }
      const publishedAt = new Date()
      await deps.prisma.postTarget.update({
        where: { id: target.id },
        data: { status: 'PUBLISHED', remoteId: result.remoteId, containerId: result.containerId ?? target.containerId, error: null, publishedAt },
      })
      if (target.account.network === 'instagram') instagramRemoteId = result.remoteId
      await audit(deps.prisma, {
        organizationId: post.organizationId,
        actorType: 'system',
        action: 'post.published',
        targetType: 'post_target',
        targetId: target.id,
        metadata: { network: target.account.network, remoteId: result.remoteId },
      })
      target.remoteId = result.remoteId
      target.status = 'PUBLISHED'
      await sendTargetFirstComment(deps, post, target)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The network could not publish this post'
      await deps.prisma.postTarget.update({
        where: { id: target.id },
        data: { status: 'FAILED', error: message },
      })
    }
  }
  const fresh = await deps.prisma.postTarget.findMany({ where: { postId: post.id } })
  const published = fresh.filter((target) => target.status === 'PUBLISHED')
  const failed = fresh.filter((target) => target.status === 'FAILED')
  const waiting = fresh.filter((target) => target.status === 'PUBLISHING')
  if (waiting.length) return
  const summary = failed.map((target) => target.error).filter((item): item is string => Boolean(item)).join('; ')
  if (!published.length) {
    await deps.prisma.post.update({
      where: { id: post.id },
      data: { status: 'FAILED', publishError: summary || 'Publish failed', igMediaId: instagramRemoteId },
    })
    throw new ApiError(409, 'publish_failed', summary || 'Publish failed')
  }
  await deps.prisma.post.update({
    where: { id: post.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: post.publishedAt ?? new Date(),
      publishError: summary || null,
      igMediaId: instagramRemoteId,
    },
  })
}

async function tokenFor(deps: Deps, organizationId: string, target: TargetRow): Promise<string> {
  if (target.account.network === 'instagram' && target.account.instagramAccountId) {
    const account = await usableToken(deps, organizationId, target.account.instagramAccountId)
    return account.token
  }
  if (!target.account.credential) {
    throw new ApiError(409, 'reconnect_required', `Reconnect the ${target.account.network} account before continuing`)
  }
  return decryptString(target.account.credential.accessTokenEnc, deps.env.TOKEN_ENCRYPTION_KEY)
}

async function sendTargetFirstComment(deps: Deps, post: Post, target: TargetRow): Promise<void> {
  const text = post.firstComment.trim()
  if (!post.approvedAt || !text || !target.remoteId || target.firstCommentRemoteId) return
  const unavailable = firstCommentUnavailableReason(target.account.network)
  if (unavailable || !firstCommentAvailable(target.account.network)) {
    if (target.firstCommentError !== unavailable) {
      await deps.prisma.postTarget.update({
        where: { id: target.id },
        data: { firstCommentError: unavailable },
      })
    }
    return
  }
  try {
    const accessToken = await tokenFor(deps, post.organizationId, target)
    const sent = await deps.networks.firstComment({
      network: target.account.network as 'instagram' | 'facebook',
      accessToken,
      remoteId: target.remoteId,
      externalId: target.account.externalId,
      text,
    })
    await deps.prisma.postTarget.update({
      where: { id: target.id },
      data: { firstCommentRemoteId: sent.id, firstCommentError: null },
    })
    if (target.account.network === 'instagram') {
      await deps.prisma.post.update({
        where: { id: post.id },
        data: { firstCommentIgId: sent.id, firstCommentError: null },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The first comment could not be posted'
    await deps.prisma.postTarget.update({
      where: { id: target.id },
      data: { firstCommentError: message },
    })
    if (target.account.network === 'instagram') {
      await deps.prisma.post.update({ where: { id: post.id }, data: { firstCommentError: message } })
    }
  }
}
