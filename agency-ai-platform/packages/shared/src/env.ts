import { z } from "zod";

/** Treat empty strings as undefined so optional secrets may be blank in .env. */
const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

/**
 * Server / API environment schema.
 * Secrets stay optional until the related feature is enabled.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  DATABASE_URL: optionalSecret,
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().max(65535).default(6379),
  REDIS_URL: optionalSecret,
  JWT_SECRET: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  STRIPE_SECRET_KEY: optionalSecret,
  STRIPE_WEBHOOK_SECRET: optionalSecret,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Vite public env (only VITE_* keys are available in the browser).
 */
export const webEnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:3000/api/v1"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: z.ZodIssue[];

  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined>,
  label = "environment",
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new EnvValidationError(`Invalid ${label}: ${details}`, result.error.issues);
  }
  return result.data;
}

/** Validate API/server env. Pass `process.env` from Node entrypoints. */
export function loadApiEnv(env: Record<string, string | undefined>): ApiEnv {
  return parseEnv(apiEnvSchema, env, "API environment");
}

/** Validate Vite public env from `import.meta.env` (or a plain record in tests). */
export function loadWebEnv(env: Record<string, string | undefined>): WebEnv {
  return parseEnv(webEnvSchema, env, "web environment");
}
