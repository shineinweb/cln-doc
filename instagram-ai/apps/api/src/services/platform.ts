import {
  buildRecommendation,
  formatMixCounts,
  metricSeries,
  storedAudienceHours,
  type FormatStats,
} from '@instagram-ai/shared'
import type { Prisma } from '@prisma/client'
import type { Deps } from '../deps'
import { audit } from '../audit'
import type { BillingUpdate } from '../providers/payments'
import { asStringArray, type CustomerContext } from './context'
import { usableToken } from './instagram'

export async function usageCounts(deps: Deps, organizationId: string, from: Date, to: Date) {
  const rows = await deps.prisma.aiUsage.groupBy({
    by: ['kind'],
    where: { organizationId, createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  })
  const count = (kind: string) => rows.find((row) => row.kind === kind)?._count._all ?? 0
  return { text: count('text'), image: count('image'), video: count('video') }
}

export async function insightsFor(deps: Deps, ctx: CustomerContext, accountId?: string) {
  const account = await deps.prisma.instagramAccount.findFirst({
    where: {
      organizationId: ctx.organization.id,
      ...(accountId ? { id: accountId } : { status: 'connected' }),
    },
  })
  let followers: Array<{ date: string; value: number }> = []
  let followersAvailable = false
  const byFormat: Record<string, FormatStats> = {}
  if (account && account.status === 'connected') {
    try {
      const token = await usableToken(deps, ctx.organization.id, account.id)
      const insights = await deps.meta.getInsights(token.token, token.igUserId)
      followersAvailable = insights.followersAvailable
      followers = insights.followers
      for (const item of insights.media) {
        const format = item.format.includes('carousel') ? 'carousel' : item.format.includes('video') ? 'reel' : 'photo'
        const current = byFormat[format] ?? { posts: 0, saves: 0, reach: 0, comments: 0 }
        current.posts += 1
        current.saves += item.saves
        current.reach += item.reach
        current.comments += item.comments
        byFormat[format] = current
      }
      await deps.prisma.metricSnapshot.create({
        data: {
          organizationId: ctx.organization.id,
          instagramAccountId: account.id,
          metric: 'insights',
          value: followers.at(-1)?.value ?? 0,
          dimensions: { followers, byFormat } as Prisma.InputJsonValue,
        },
      })
      const audienceOnline = storedAudienceHours({ hours: insights.audienceOnline })
      if (audienceOnline.length) {
        await deps.prisma.metricSnapshot.create({
          data: {
            organizationId: ctx.organization.id,
            instagramAccountId: account.id,
            metric: 'audience_online',
            value: audienceOnline.length,
            dimensions: { hours: audienceOnline } as Prisma.InputJsonValue,
          },
        })
      }
    } catch {
      followersAvailable = false
    }
  }
  const [awaitingApproval, publishingFailures, comments] = await Promise.all([
    deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'PENDING_APPROVAL' } }),
    deps.prisma.post.count({ where: { organizationId: ctx.organization.id, status: 'FAILED' } }),
    deps.prisma.comment.findMany({
      where: { organizationId: ctx.organization.id, replied: true, repliedAt: { not: null } },
      select: { createdAt: true, repliedAt: true },
    }),
  ])
  const samples = comments.flatMap((comment) => {
    if (!comment.repliedAt) return []
    return [(comment.repliedAt.getTime() - comment.createdAt.getTime()) / 60000]
  })
  const quotaUsed = await usageCounts(
    deps,
    ctx.organization.id,
    ctx.subscription.currentPeriodStart,
    ctx.subscription.currentPeriodEnd,
  )
  const quota = {
    text: { used: quotaUsed.text, limit: ctx.subscription.package.monthlyAiGenerations },
    image: { used: quotaUsed.image, limit: ctx.subscription.package.monthlyImageGenerations },
    video: { used: quotaUsed.video, limit: ctx.subscription.package.monthlyVideoGenerations },
  }
  const charts = await storedInsightCharts(deps, ctx.organization.id)
  return {
    followers: { available: followersAvailable, series: followers },
    engagementByFormat: byFormat,
    responseTimes: {
      averageMinutes: samples.length ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length) : null,
      sample: samples.length,
    },
    awaitingApproval,
    publishingFailures,
    quota,
    recommendation: buildRecommendation(byFormat, publishingFailures, quota),
    charts,
  }
}

export async function storedReport(deps: Deps, organizationId: string, from: Date, to: Date) {
  const rows = await deps.prisma.metricSnapshot.findMany({
    where: { organizationId, capturedAt: { gte: from, lte: to } },
    orderBy: { capturedAt: 'asc' },
  })
  const stored = rows.map((row) => ({
    metric: row.metric,
    value: row.value,
    capturedAt: row.capturedAt,
    network: row.network,
    postId: row.postId,
  }))
  const formats = await deps.prisma.post.findMany({
    where: { organizationId, createdAt: { gte: from, lte: to } },
    select: { format: true },
  })
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows: rows.map((row) => ({
      id: row.id,
      metric: row.metric,
      value: row.value,
      capturedAt: row.capturedAt,
      instagramAccountId: row.instagramAccountId,
      postId: row.postId,
      network: row.network,
      dimensions: row.dimensions ?? null,
    })),
    charts: {
      reach: metricSeries(stored, 'reach'),
      engagement: metricSeries(stored, 'engagement'),
      formatMix: formatMixCounts(formats.map((post) => post.format)),
    },
  }
}

export async function storedInsightCharts(deps: Deps, organizationId: string) {
  const rows = await deps.prisma.metricSnapshot.findMany({
    where: {
      organizationId,
      metric: { in: ['reach', 'engagement'] },
    },
    orderBy: { capturedAt: 'asc' },
  })
  const stored = rows.map((row) => ({
    metric: row.metric,
    value: row.value,
    capturedAt: row.capturedAt,
    network: row.network,
    postId: row.postId,
  }))
  return {
    reach: metricSeries(stored, 'reach'),
    engagement: metricSeries(stored, 'engagement'),
  }
}

export async function applyBillingUpdate(deps: Deps, update: BillingUpdate): Promise<void> {
  if (!update.externalId || (!update.status && !update.packageId)) return
  const existing = await deps.prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'stripe', externalId: update.externalId } },
  })
  if (existing) return
  const subscription = update.organizationId
    ? await deps.prisma.subscription.findUnique({ where: { organizationId: update.organizationId } })
    : update.providerSubscriptionId
      ? await deps.prisma.subscription.findFirst({ where: { providerSubscriptionId: update.providerSubscriptionId } })
      : null
  if (!subscription) return
  if (update.packageId) {
    const pkg = await deps.prisma.package.findUnique({ where: { id: update.packageId } })
    if (!pkg) return
  }
  await deps.prisma.webhookEvent.create({
    data: {
      provider: 'stripe',
      externalId: update.externalId,
      organizationId: subscription.organizationId,
      payload: update as unknown as Prisma.InputJsonValue,
    },
  })
  await deps.prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: update.status,
      packageId: update.packageId,
      provider: 'stripe',
      providerCustomerId: update.providerCustomerId,
      providerSubscriptionId: update.providerSubscriptionId,
    },
  })
  await deps.prisma.subscriptionEvent.create({
    data: {
      subscriptionId: subscription.id,
      type: update.status ?? 'updated',
      payload: update as unknown as Prisma.InputJsonValue,
    },
  })
}

export async function deleteOrganization(deps: Deps, organizationId: string, actorId: string, actorType: 'user' | 'staff' = 'user'): Promise<void> {
  const assets = await deps.prisma.mediaAsset.findMany({ where: { organizationId } })
  const templateAssets = await deps.prisma.templateAsset.findMany({ where: { organizationId } })
  const [tokens, posts, comments, messages] = await Promise.all([
    deps.prisma.oauthCredential.count({ where: { organizationId } }),
    deps.prisma.post.count({ where: { organizationId } }),
    deps.prisma.comment.count({ where: { organizationId } }),
    deps.prisma.message.count({ where: { organizationId } }),
  ])
  await deps.prisma.$transaction(async (tx) => {
    const postIds = (await tx.post.findMany({ where: { organizationId }, select: { id: true } })).map((post) => post.id)
    const campaignIds = (await tx.campaign.findMany({ where: { organizationId }, select: { id: true } })).map((row) => row.id)
    await tx.idea.deleteMany({ where: { organizationId } })
    await tx.campaignPost.deleteMany({ where: { campaignId: { in: campaignIds } } })
    await tx.campaign.deleteMany({ where: { organizationId } })
    await tx.postTarget.deleteMany({ where: { postId: { in: postIds } } })
    await tx.postMedia.deleteMany({ where: { postId: { in: postIds } } })
    await tx.message.deleteMany({ where: { organizationId } })
    await tx.conversation.deleteMany({ where: { organizationId } })
    await tx.comment.deleteMany({ where: { organizationId } })
    await tx.draftFeedback.deleteMany({ where: { organizationId } })
    await tx.generationJob.deleteMany({ where: { organizationId } })
    await tx.metricSnapshot.deleteMany({ where: { organizationId } })
    await tx.post.deleteMany({ where: { organizationId } })
    await tx.template.deleteMany({ where: { organizationId } })
    await tx.templateAsset.deleteMany({ where: { organizationId } })
    await tx.faceConsent.deleteMany({ where: { organizationId } })
    await tx.mediaAsset.deleteMany({ where: { organizationId } })
    await tx.socialCredential.deleteMany({ where: { organizationId } })
    await tx.socialAccount.deleteMany({ where: { organizationId } })
    await tx.oauthCredential.deleteMany({ where: { organizationId } })
    await tx.instagramAccount.deleteMany({ where: { organizationId } })
    await tx.automationRule.deleteMany({ where: { organizationId } })
    await tx.savedResponse.deleteMany({ where: { organizationId } })
    await tx.webhookEvent.deleteMany({ where: { organizationId } })
    await tx.aiKnowledge.deleteMany({ where: { organizationId } })
    await tx.aiUsage.deleteMany({ where: { organizationId } })
    await tx.aiProfile.deleteMany({ where: { organizationId } })
    await tx.brandProfile.deleteMany({ where: { organizationId } })
    await tx.contentCategory.deleteMany({ where: { organizationId } })
    await tx.invitation.deleteMany({ where: { organizationId } })
    await tx.membership.deleteMany({ where: { organizationId } })
    const subscription = await tx.subscription.findUnique({ where: { organizationId } })
    if (subscription) await tx.subscriptionEvent.deleteMany({ where: { subscriptionId: subscription.id } })
    await tx.subscription.deleteMany({ where: { organizationId } })
    await tx.oauthState.deleteMany({ where: { organizationId } })
    await tx.auditLog.deleteMany({ where: { organizationId } })
    await tx.organization.delete({ where: { id: organizationId } })
  })
  for (const asset of assets) await deps.storage.remove(asset.storageKey)
  for (const asset of templateAssets) await deps.storage.remove(asset.storageKey)
  await audit(deps.prisma, {
    organizationId: null,
    actorType,
    actorId,
    action: 'organization.deleted',
    targetType: 'organization',
    targetId: organizationId,
    metadata: { organizationId, tokens, posts, comments, messages, media: assets.length },
  })
}

export { asStringArray }
