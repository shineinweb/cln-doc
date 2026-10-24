import type { HashtagChip } from '@instagram-ai/shared'

export type PackageInfo = {
  id: string
  name: string
  description: string
  priceMinor: number
  currency: string
  instagramAccounts: number
  seats: number
  monthlyAiGenerations: number
  monthlyImageGenerations: number
  monthlyVideoGenerations: number
  scheduling: boolean
  commentInbox: boolean
  dmInbox: boolean
  automation: boolean
  customAi: boolean
  videoGeneration: boolean
}

export type AccountInfo = {
  id: string
  username: string
  status: string
  lastError: string | null
  timezone: string
  scopes: string
}

export type PostMedia = { id: string; url: string; mimeType: string; filename: string; position: number }

export type Claim = { claim: string; needsReview: boolean; accepted: boolean }

export type PostRecord = {
  id: string
  status: string
  format: string
  categoryId: string | null
  description: string
  caption: string
  keywords: string[]
  hashtags: HashtagChip[]
  creativeBrief: string | null
  callToAction: string | null
  alternativeCaptions: string[]
  factualClaims: Claim[]
  claimsNeedReview: boolean
  scheduledAt: string | null
  publishError: string | null
  approvedAt: string | null
  instagramAccountId: string | null
  media: PostMedia[]
}

export type PublicPage = {
  path: string
  title: string
  description: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  indexed: boolean
  inSitemap: boolean
  body: string
}

export type PublicConfig = {
  productName: string
  supportEmail: string
  maintenanceMessage: string
  registrationOpen: boolean
  canonicalHost: string
  siteDescription: string
}
