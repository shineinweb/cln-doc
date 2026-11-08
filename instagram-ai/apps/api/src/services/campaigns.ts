import {
  OFFICIAL_CAMPAIGN_METRICS,
  campaignMetricTotals,
  metricSeries,
  metricsByNetwork,
  type OfficialCampaignMetric,
} from '@instagram-ai/shared'
import type { Deps } from '../deps'
import { ApiError, notFound } from '../errors'

export async function loadCampaign(deps: Deps, organizationId: string, id: string) {
  const campaign = await deps.prisma.campaign.findFirst({
    where: { id, organizationId },
    include: {
      posts: {
        include: {
          post: {
            include: {
              media: { include: { asset: true }, orderBy: { position: 'asc' as const } },
              targets: { include: { account: true } },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!campaign) throw notFound('Campaign not found')
  return campaign
}

export async function campaignDashboard(deps: Deps, organizationId: string, campaignId: string) {
  const campaign = await loadCampaign(deps, organizationId, campaignId)
  const postIds = campaign.posts.map((row) => row.postId)
  if (!postIds.length) {
    return {
      campaign: presentCampaign(campaign),
      totals: { impressions: null, reach: null, engagement: null },
      series: { reach: [], engagement: [] },
      byNetwork: [] as Array<{ name: string; value: number }>,
      rows: [] as Array<{
        id: string
        metric: string
        value: number
        network: string | null
        postId: string | null
        capturedAt: Date
      }>,
    }
  }
  const rows = await deps.prisma.metricSnapshot.findMany({
    where: {
      organizationId,
      postId: { in: postIds },
      metric: { in: [...OFFICIAL_CAMPAIGN_METRICS] },
      capturedAt: { gte: campaign.startsAt, lte: campaign.endsAt },
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
    campaign: presentCampaign(campaign),
    totals: campaignMetricTotals(stored),
    series: {
      reach: metricSeries(stored, 'reach'),
      engagement: metricSeries(stored, 'engagement'),
    },
    byNetwork: metricsByNetwork(stored, 'reach'),
    rows: rows.map((row) => ({
      id: row.id,
      metric: row.metric,
      value: row.value,
      network: row.network,
      postId: row.postId,
      capturedAt: row.capturedAt,
    })),
  }
}

export function presentCampaign(campaign: {
  id: string
  name: string
  startsAt: Date
  endsAt: Date
  createdAt: Date
  updatedAt: Date
  posts?: Array<{
    postId: string
    post?: {
      id: string
      status: string
      format: string
      description: string
      caption: string
      scheduledAt: Date | null
      publishedAt: Date | null
      approvedAt: Date | null
    }
  }>
}) {
  return {
    id: campaign.id,
    name: campaign.name,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    postIds: (campaign.posts ?? []).map((row) => row.postId),
    posts: (campaign.posts ?? []).map((row) => row.post).filter(Boolean),
  }
}

export async function attachCampaignPosts(
  deps: Deps,
  organizationId: string,
  campaignId: string,
  postIds: string[],
) {
  const campaign = await deps.prisma.campaign.findFirst({ where: { id: campaignId, organizationId } })
  if (!campaign) throw notFound('Campaign not found')
  const unique = [...new Set(postIds)]
  if (!unique.length) throw new ApiError(400, 'validation', 'Choose at least one post')
  const posts = await deps.prisma.post.findMany({
    where: { organizationId, id: { in: unique } },
    select: { id: true },
  })
  if (posts.length !== unique.length) throw new ApiError(404, 'not_found', 'A post was not found')
  await deps.prisma.campaignPost.createMany({
    data: unique.map((postId) => ({ campaignId, postId })),
    skipDuplicates: true,
  })
  return loadCampaign(deps, organizationId, campaignId)
}

export type OfficialMetricInput = {
  postId: string
  metric: OfficialCampaignMetric
  value: number
  network?: string | null
  capturedAt?: Date
}
