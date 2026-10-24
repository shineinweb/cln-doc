import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).default(43200),
  REDIS_URL: z.string().min(1),
  S3_ENDPOINT: z.string().min(1),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).transform((value) => value === 'true'),
  // Present for a later submission phase. Inventory import does not read them.
  METRC_INTEGRATOR_KEY: z.string().default(''),
  METRC_USER_KEY: z.string().default(''),
  /** Optional server-wide OpenAI key for Serenity. Organization Settings can override per company. */
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  /** console logs mail (default). sendgrid uses SENDGRID_API_KEY. */
  MAIL_DRIVER: z.enum(['console', 'sendgrid']).default('console'),
  SENDGRID_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@serenity.local'),
  EMAIL_FROM_NAME: z.string().default('Serenity Universal'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment:\n${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}
