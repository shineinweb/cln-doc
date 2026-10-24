import type { PrismaClient } from '@prisma/client'

export type SiteSettings = {
  general: {
    productName: string
    logo: string
    supportEmail: string
    publicSiteUrl: string
    registrationOpen: boolean
    maintenanceMessage: string
  }
  legal: {
    privacy: string
    terms: string
    dataDeletion: string
  }
  features: {
    scheduling: boolean
    videoGeneration: boolean
    inboxAutomation: boolean
    customAi: boolean
    signups: boolean
  }
  ai: {
    allowedModels: {
      starter: string[]
      growth: string[]
      pro: string[]
    }
  }
  instagram: {
    oauthCallbackUrl: string
  }
  email: {
    inviteTemplate: string
    resetTemplate: string
  }
  seo: {
    titleTemplate: string
    siteDescription: string
    canonicalHost: string
    defaultShareImage: string
  }
  robots: string
}

export const defaultSettings = (callbackUrl: string): SiteSettings => ({
  general: {
    productName: 'Instagram AI',
    logo: '',
    supportEmail: 'support@example.com',
    publicSiteUrl: 'http://localhost:5173',
    registrationOpen: true,
    maintenanceMessage: '',
  },
  legal: {
    privacy:
      'Instagram AI stores your account, brand profile, and encrypted Instagram tokens so you can publish and reply. We do not sell personal data. Disconnecting an account deletes its token. Deleting an organization removes its members, tokens, media, and product rows.',
    terms:
      'Instagram AI publishes and replies only after a person approves the content, and only through Meta’s official APIs. The product does not like, follow, unfollow, or create followers. You are responsible for the content you approve.',
    dataDeletion:
      'To delete your data, sign in and delete the organization, or email the support address and ask for deletion. Deletion removes memberships, Instagram tokens, media, drafts, inboxes, and the organization record. A platform audit entry keeps the organization id and the time of the deletion.',
  },
  features: {
    scheduling: true,
    videoGeneration: true,
    inboxAutomation: true,
    customAi: true,
    signups: true,
  },
  ai: {
    allowedModels: {
      starter: ['platform-default'],
      growth: ['platform-default'],
      pro: ['platform-default', 'gpt-4o-mini', 'gpt-4o'],
    },
  },
  instagram: {
    oauthCallbackUrl: callbackUrl,
  },
  email: {
    inviteTemplate: 'You were invited to join {{organization}} on {{product}}. Open {{link}} to accept.',
    resetTemplate: 'Reset your {{product}} password: {{link}}',
  },
  seo: {
    titleTemplate: '{{page}} · {{product}}',
    siteDescription: 'Plan, approve, and publish Instagram content with the official API.',
    canonicalHost: 'http://localhost:5173',
    defaultShareImage: '',
  },
  robots: 'User-agent: *\nAllow: /\nDisallow: /app\n',
})

const GROUPS = ['general', 'legal', 'features', 'ai', 'instagram', 'email', 'seo', 'robots'] as const

export async function loadSettings(prisma: PrismaClient, callbackUrl: string): Promise<SiteSettings> {
  const defaults = defaultSettings(callbackUrl)
  const rows = await prisma.siteSetting.findMany()
  const settings = structuredClone(defaults)
  for (const row of rows) {
    if (!GROUPS.includes(row.key as (typeof GROUPS)[number])) continue
    if (row.key === 'robots' && typeof row.value === 'string') {
      settings.robots = row.value
      continue
    }
    const current = settings[row.key as keyof Omit<SiteSettings, 'robots'>]
    if (current && row.value && typeof row.value === 'object' && !Array.isArray(row.value)) {
      Object.assign(current, row.value)
    }
  }
  return settings
}

export async function saveSettings(prisma: PrismaClient, patch: Partial<SiteSettings>, callbackUrl: string): Promise<SiteSettings> {
  const next = await loadSettings(prisma, callbackUrl)
  for (const key of GROUPS) {
    if (patch[key] === undefined) continue
    if (key === 'robots' && typeof patch.robots === 'string') next.robots = patch.robots
    else Object.assign(next[key], patch[key])
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: next[key] as never },
      update: { value: next[key] as never },
    })
  }
  return loadSettings(prisma, callbackUrl)
}

export function registrationOpen(settings: SiteSettings): boolean {
  return settings.general.registrationOpen && settings.features.signups
}
