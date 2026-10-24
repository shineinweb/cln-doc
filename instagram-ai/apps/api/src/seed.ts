import type { PrismaClient } from '@prisma/client'
import type { Env } from './env'
import { hashPassword } from './crypto'
import { defaultSettings } from './settings'

export const PACKAGE_SEED = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'One Instagram account, manual publishing, and a small monthly text and photo quota.',
    priceMinor: 0,
    currency: 'USD',
    instagramAccounts: 1,
    seats: 1,
    monthlyAiGenerations: 20,
    monthlyImageGenerations: 5,
    monthlyVideoGenerations: 0,
    scheduling: false,
    commentInbox: false,
    dmInbox: false,
    automation: false,
    customAi: false,
    videoGeneration: false,
    sortOrder: 1,
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'Scheduling, the comment inbox, and a small monthly video quota.',
    priceMinor: 2900,
    currency: 'USD',
    instagramAccounts: 3,
    seats: 5,
    monthlyAiGenerations: 200,
    monthlyImageGenerations: 50,
    monthlyVideoGenerations: 5,
    scheduling: true,
    commentInbox: true,
    dmInbox: false,
    automation: false,
    customAi: false,
    videoGeneration: true,
    sortOrder: 2,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Direct messages, limited automation, custom AI, and the highest quotas.',
    priceMinor: 9900,
    currency: 'USD',
    instagramAccounts: 10,
    seats: 15,
    monthlyAiGenerations: 2000,
    monthlyImageGenerations: 500,
    monthlyVideoGenerations: 50,
    scheduling: true,
    commentInbox: true,
    dmInbox: true,
    automation: true,
    customAi: true,
    videoGeneration: true,
    sortOrder: 3,
  },
] as const

const PAGES = [
  ['/', 'Instagram AI', 'Approve and publish Instagram posts through Meta’s official API. No follow or like automation.', true],
  ['/pricing', 'Pricing', 'Starter, Growth, and Pro packages for Instagram publishing, inboxes, and custom AI.', true],
  ['/privacy', 'Privacy policy', 'How Instagram AI stores accounts, tokens, and content.', true],
  ['/terms', 'Terms', 'What the product will and will not do on Instagram.', true],
  ['/data-deletion', 'Data deletion', 'How to delete an organization, tokens, and media.', true],
  ['/login', 'Log in', 'Log in to your Instagram AI workspace.', true],
] as const

export async function seedReference(prisma: PrismaClient, env: Pick<Env, 'META_REDIRECT_URI' | 'STAFF_SEED_EMAIL' | 'STAFF_SEED_PASSWORD'>): Promise<void> {
  for (const pkg of PACKAGE_SEED) {
    await prisma.package.upsert({
      where: { id: pkg.id },
      create: pkg,
      update: pkg,
    })
  }
  const settings = defaultSettings(env.META_REDIRECT_URI)
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    })
  }
  for (const [path, title, description, indexed] of PAGES) {
    await prisma.publicPage.upsert({
      where: { path },
      create: {
        path,
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        ogImage: '',
        indexed,
        inSitemap: indexed,
      },
      update: {},
    })
  }
  const existingSet = await prisma.seoSet.findFirst({ where: { name: 'Cafe hours' } })
  if (!existingSet) {
    await prisma.seoSet.create({
      data: {
        name: 'Cafe hours',
        category: 'Offer',
        keywords: ['cafe hours', 'neighborhood coffee'],
        hashtags: ['cafehours', 'localcoffee'],
      },
    })
  }
  const staffEmail = env.STAFF_SEED_EMAIL.toLowerCase()
  const existingStaff = await prisma.staffUser.findUnique({ where: { email: staffEmail } })
  if (!existingStaff) {
    await prisma.staffUser.create({
      data: {
        email: staffEmail,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        passwordHash: await hashPassword(env.STAFF_SEED_PASSWORD),
      },
    })
  }
}
