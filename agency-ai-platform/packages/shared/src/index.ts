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

export {
  apiEnvSchema,
  webEnvSchema,
  parseEnv,
  loadApiEnv,
  loadWebEnv,
  EnvValidationError,
} from "./env";
export type { ApiEnv, WebEnv } from "./env";

export {
  COMMERCIAL_LIFECYCLE,
  COMMERCIAL_LIFECYCLE_STAGES,
  isCommercialLifecycleStage,
} from "./lifecycle";
export type { CommercialLifecycleStage } from "./lifecycle";

export {
  PROJECT_DELIVERY_HIERARCHY,
  PROJECT_DELIVERY_MODELS,
  PROJECT_STATUS_PIPELINE,
  PROJECT_STATUS_STAGES,
  isProjectStatusStage,
} from "./delivery";
export type { ProjectDeliveryModel, ProjectStatusStage } from "./delivery";

export { WEBSITE_DEVELOPMENT_PACKAGE, formatUsdFromCents } from "./catalog";
export type { WebsiteDevelopmentPackage } from "./catalog";
