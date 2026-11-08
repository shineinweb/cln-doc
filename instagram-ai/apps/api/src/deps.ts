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
import { RealNetworkGateway, type NetworkGateway } from './providers/networks'
import { readProviderEnabled } from './settings'
import { RealGoogleAuth, type GoogleAuth } from './providers/google'

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
  videoFetch: typeof fetch
  httpFetch: typeof fetch
  networks: NetworkGateway
  google: GoogleAuth
}

export function createDeps(env: Env, overrides: Partial<Deps> = {}): Deps {
  const meta = overrides.meta ?? createMetaClient(env)
  const prisma = overrides.prisma ?? rootPrisma
  return {
    env,
    prisma,
    logger: overrides.logger ?? rootLogger,
    meta,
    text: overrides.text ?? createTextProvider(env, async () => (await readProviderEnabled(prisma)).openai),
    media: overrides.media ?? createMediaProvider(env),
    payments: overrides.payments ?? createPaymentProvider(env),
    storage: overrides.storage ?? new LocalStorage(env.STORAGE_DIR, env.MEDIA_PUBLIC_BASE_URL),
    inlineJobs: overrides.inlineJobs ?? false,
    videoFetch: overrides.videoFetch ?? fetch,
    httpFetch: overrides.httpFetch ?? fetch,
    networks: overrides.networks ?? new RealNetworkGateway(meta, fetch),
    google: overrides.google ?? new RealGoogleAuth(fetch),
  }
}
