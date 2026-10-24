import type { Logger } from 'pino'
import type { PrismaClient } from '@prisma/client'
import type { Env } from './env'
import { logger as rootLogger } from './logger'
import { prisma as rootPrisma } from './db'
import { LocalStorage } from './storage'
import { createMediaProvider, type MediaProvider } from './providers/media'
import { createMetaClient, type MetaClient } from './providers/meta'
import { createPaymentProvider, type PaymentProvider } from './providers/payments'
import { createTextProvider, type TextProvider } from './providers/text'

export type Deps = {
  env: Env
  prisma: PrismaClient
  logger: Logger
  meta: MetaClient
  text: TextProvider
  media: MediaProvider
  payments: PaymentProvider
  storage: LocalStorage
  inlineJobs: boolean
}

export function createDeps(env: Env, overrides: Partial<Deps> = {}): Deps {
  return {
    env,
    prisma: overrides.prisma ?? rootPrisma,
    logger: overrides.logger ?? rootLogger,
    meta: overrides.meta ?? createMetaClient(env),
    text: overrides.text ?? createTextProvider(env),
    media: overrides.media ?? createMediaProvider(env),
    payments: overrides.payments ?? createPaymentProvider(env),
    storage: overrides.storage ?? new LocalStorage(env.STORAGE_DIR, env.MEDIA_PUBLIC_BASE_URL),
    inlineJobs: overrides.inlineJobs ?? false,
  }
}
