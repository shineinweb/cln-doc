import type { PrismaClient } from '@prisma/client'
import { decryptString, encryptString } from './crypto'

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
    facePersonalization: boolean
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
    facePersonalization: true,
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

const SECRET_ROWS = {
  openaiKey: 'secret.openai',
  runwayKey: 'secret.runway',
  videoProviderUrl: 'secret.videoProviderUrl',
} as const

const ENABLED_ROW = 'provider.enabled'

export const PROVIDER_NAMES = ['openai', 'runway', 'videoProvider'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]
export type ProviderEnabled = Record<ProviderName, boolean>

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  openai: 'OpenAI',
  runway: 'Runway',
  videoProvider: 'The video provider',
}

export const OPENAI_OFF_NOTICE = 'OpenAI is turned off by the admin'
export const FACE_OFF_NOTICE = 'Face personalization is turned off for the whole site'

export type ProviderStatusText = {
  openai: string
  runway: string
  videoProvider: string
}

export type ProviderSecretFlags = {
  openaiKeySet: boolean
  runwayKeySet: boolean
  videoProviderUrlSet: boolean
  openaiEnabled: boolean
  runwayEnabled: boolean
  videoProviderUrlEnabled: boolean
  status: ProviderStatusText
}

export type ProviderSecrets = {
  openaiKey: string | null
  runwayKey: string | null
  videoProviderUrl: string | null
  enabled: ProviderEnabled
}

export async function readProviderEnabled(prisma: PrismaClient): Promise<ProviderEnabled> {
  const row = await prisma.siteSetting.findUnique({ where: { key: ENABLED_ROW } })
  const stored = row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? (row.value as Record<string, unknown>) : {}
  return {
    openai: stored.openai !== false,
    runway: stored.runway !== false,
    videoProvider: stored.videoProvider !== false,
  }
}

export async function writeProviderEnabled(prisma: PrismaClient, patch: Partial<ProviderEnabled>): Promise<ProviderEnabled> {
  const next = { ...(await readProviderEnabled(prisma)) }
  for (const name of PROVIDER_NAMES) {
    if (typeof patch[name] === 'boolean') next[name] = patch[name] as boolean
  }
  await prisma.siteSetting.upsert({
    where: { key: ENABLED_ROW },
    create: { key: ENABLED_ROW, value: next },
    update: { value: next },
  })
  return next
}

export function providerStatusText(set: { openai: boolean; runway: boolean; videoProvider: boolean }, enabled: ProviderEnabled): ProviderStatusText {
  const line = (label: string, name: ProviderName) => `${label}: ${set[name] ? 'set' : 'not set'}, ${enabled[name] ? 'on' : 'off'}`
  return {
    openai: line('OpenAI key', 'openai'),
    runway: line('Runway key', 'runway'),
    videoProvider: line('Video provider URL', 'videoProvider'),
  }
}

export function isOpenAiVideoEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    const parts = url.pathname.split('/').filter(Boolean)
    return url.hostname === 'api.openai.com' && parts[0] === 'v1' && parts[1] === 'videos'
  } catch {
    return false
  }
}

export function assertProviderUrl(value: string): string {
  const trimmed = value.trim()
  if (/^key_[A-Za-z0-9]/.test(trimmed)) {
    throw new Error('Paste a video provider URL, not a Runway key')
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Enter an http or https video provider URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Enter an http or https video provider URL')
  }
  if (isOpenAiVideoEndpoint(url.toString())) {
    throw new Error('OpenAI video generation is not available')
  }
  return url.toString()
}

function ciphertext(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const enc = (value as { enc?: unknown }).enc
  return typeof enc === 'string' && enc.length > 0 ? enc : null
}

export async function providerSecretFlags(prisma: PrismaClient): Promise<ProviderSecretFlags> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(SECRET_ROWS) } } })
  const present = new Set(rows.filter((row) => ciphertext(row.value)).map((row) => row.key))
  const enabled = await readProviderEnabled(prisma)
  const set = {
    openai: present.has(SECRET_ROWS.openaiKey),
    runway: present.has(SECRET_ROWS.runwayKey),
    videoProvider: present.has(SECRET_ROWS.videoProviderUrl),
  }
  return {
    openaiKeySet: set.openai,
    runwayKeySet: set.runway,
    videoProviderUrlSet: set.videoProvider,
    openaiEnabled: enabled.openai,
    runwayEnabled: enabled.runway,
    videoProviderUrlEnabled: enabled.videoProvider,
    status: providerStatusText(set, enabled),
  }
}

export async function readProviderSecrets(prisma: PrismaClient, keyHex: string): Promise<ProviderSecrets> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(SECRET_ROWS) } } })
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const read = (key: string): string | null => {
    const enc = ciphertext(byKey.get(key))
    if (!enc) return null
    try {
      const plain = decryptString(enc, keyHex).trim()
      return plain || null
    } catch {
      return null
    }
  }
  return {
    openaiKey: read(SECRET_ROWS.openaiKey),
    runwayKey: read(SECRET_ROWS.runwayKey),
    videoProviderUrl: read(SECRET_ROWS.videoProviderUrl),
    enabled: await readProviderEnabled(prisma),
  }
}

export const OAUTH_APPS = ['instagram', 'facebook', 'tiktok', 'youtube', 'google'] as const
export type OauthAppName = (typeof OAUTH_APPS)[number]

export type OauthAppFlags = Record<OauthAppName, { clientIdSet: boolean; clientSecretSet: boolean }>

function oauthSecretKey(app: OauthAppName, field: 'clientId' | 'clientSecret'): string {
  return `secret.oauth.${app}.${field}`
}

function emptyOauthFlags(): OauthAppFlags {
  return {
    instagram: { clientIdSet: false, clientSecretSet: false },
    facebook: { clientIdSet: false, clientSecretSet: false },
    tiktok: { clientIdSet: false, clientSecretSet: false },
    youtube: { clientIdSet: false, clientSecretSet: false },
    google: { clientIdSet: false, clientSecretSet: false },
  }
}

export async function oauthAppFlags(prisma: PrismaClient): Promise<OauthAppFlags> {
  const keys = OAUTH_APPS.flatMap((app) => [oauthSecretKey(app, 'clientId'), oauthSecretKey(app, 'clientSecret')])
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } })
  const present = new Set(rows.filter((row) => ciphertext(row.value)).map((row) => row.key))
  const flags = emptyOauthFlags()
  for (const app of OAUTH_APPS) {
    flags[app] = {
      clientIdSet: present.has(oauthSecretKey(app, 'clientId')),
      clientSecretSet: present.has(oauthSecretKey(app, 'clientSecret')),
    }
  }
  return flags
}

export async function readOauthApp(
  prisma: PrismaClient,
  keyHex: string,
  app: OauthAppName,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: [oauthSecretKey(app, 'clientId'), oauthSecretKey(app, 'clientSecret')] } },
  })
  const byKey = new Map(rows.map((row) => [row.key, row.value]))
  const read = (key: string): string | null => {
    const enc = ciphertext(byKey.get(key))
    if (!enc) return null
    try {
      const plain = decryptString(enc, keyHex).trim()
      return plain || null
    } catch {
      return null
    }
  }
  const clientId = read(oauthSecretKey(app, 'clientId'))
  const clientSecret = read(oauthSecretKey(app, 'clientSecret'))
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export async function writeOauthApps(
  prisma: PrismaClient,
  keyHex: string,
  patch: Partial<Record<OauthAppName, { clientId?: string | null; clientSecret?: string | null }>>,
): Promise<OauthAppFlags> {
  for (const app of OAUTH_APPS) {
    const next = patch[app]
    if (!next) continue
    for (const field of ['clientId', 'clientSecret'] as const) {
      if (next[field] === undefined) continue
      const key = oauthSecretKey(app, field)
      const trimmed = next[field] === null ? '' : String(next[field]).trim()
      if (!trimmed) {
        await prisma.siteSetting.deleteMany({ where: { key } })
        continue
      }
      await prisma.siteSetting.upsert({
        where: { key },
        create: { key, value: { enc: encryptString(trimmed, keyHex) } },
        update: { value: { enc: encryptString(trimmed, keyHex) } },
      })
    }
  }
  return oauthAppFlags(prisma)
}

export async function writeProviderSecrets(
  prisma: PrismaClient,
  keyHex: string,
  patch: {
    openaiKey?: string | null
    runwayKey?: string | null
    videoProviderUrl?: string | null
    openaiEnabled?: boolean
    runwayEnabled?: boolean
    videoProviderUrlEnabled?: boolean
  },
): Promise<ProviderSecretFlags> {
  const entries: Array<[string, string | null | undefined]> = [
    [SECRET_ROWS.openaiKey, patch.openaiKey],
    [SECRET_ROWS.runwayKey, patch.runwayKey],
    [SECRET_ROWS.videoProviderUrl, patch.videoProviderUrl],
  ]
  for (const [key, value] of entries) {
    if (value === undefined) continue
    const trimmed = value === null ? '' : value.trim()
    if (!trimmed) {
      await prisma.siteSetting.deleteMany({ where: { key } })
      continue
    }
    const stored = key === SECRET_ROWS.videoProviderUrl ? assertProviderUrl(trimmed) : trimmed
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: { enc: encryptString(stored, keyHex) } },
      update: { value: { enc: encryptString(stored, keyHex) } },
    })
  }
  const toggles: Partial<ProviderEnabled> = {}
  if (patch.openaiEnabled !== undefined) toggles.openai = patch.openaiEnabled
  if (patch.runwayEnabled !== undefined) toggles.runway = patch.runwayEnabled
  if (patch.videoProviderUrlEnabled !== undefined) toggles.videoProvider = patch.videoProviderUrlEnabled
  if (Object.keys(toggles).length) await writeProviderEnabled(prisma, toggles)
  return providerSecretFlags(prisma)
}
