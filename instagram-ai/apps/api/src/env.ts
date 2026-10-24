import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

function loadDotEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env'),
  ]
  for (const file of candidates) {
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return
  }
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  SESSION_SECRET: z.string().min(16),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  ADMIN_ORIGIN: z.string().default('http://localhost:5174'),
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_REDIRECT_URI: z.string().default('http://localhost:4000/api/integrations/instagram/callback'),
  META_VERIFY_TOKEN: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  BILLING_DEV_ASSIGN: z
    .string()
    .optional()
    .default('true')
    .transform((value) => value === 'true'),
  TEXT_PROVIDER_KEY: z.string().optional().default(''),
  MEDIA_PROVIDER_KEY: z.string().optional().default(''),
  VIDEO_PROVIDER_URL: z.string().optional().default(''),
  MEDIA_PUBLIC_BASE_URL: z.string().default('http://localhost:4000'),
  STORAGE_DIR: z.string().default('./data/media'),
  STAFF_SEED_EMAIL: z.string().default('staff@example.com'),
  STAFF_SEED_PASSWORD: z.string().default('change-me-now'),
  EXPOSE_DEV_TOKENS: z
    .string()
    .optional()
    .default('false')
    .transform((value) => value === 'true'),
  LOGIN_RATE_LIMIT: z.coerce.number().default(8),
  LOGIN_RATE_WINDOW_MS: z.coerce.number().default(600000),
})

export type Env = z.infer<typeof schema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env) loadDotEnv()
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment: ${message}`)
  }
  return parsed.data
}
