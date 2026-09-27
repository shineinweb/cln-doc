export const APP_NAMES = {
  website: "website",
  clientPortal: "client-portal",
  admin: "admin",
  api: "api",
} as const;

export type AppName = (typeof APP_NAMES)[keyof typeof APP_NAMES];

export type ApiHealth = {
  status: "ok" | "degraded" | "down";
  service: string;
  timestamp: string;
};

export function assertNever(value: never, message = "Unexpected value"): never {
  throw new Error(`${message}: ${String(value)}`);
}
