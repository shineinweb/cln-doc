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

export {
  QUOTE_ACTIONABLE_STATUSES,
  QUOTE_CUSTOMER_ACTIONS,
  QUOTE_STATUSES,
  canPerformQuoteAction,
  isQuoteCustomerAction,
  nextQuoteStatusAfterAction,
} from "./quotes";
export type { QuoteCustomerAction, QuoteStatusValue } from "./quotes";

export {
  BILLING_DOMAIN_MODELS,
  REFUND_WORKFLOW,
  REFUND_WORKFLOW_STAGES,
  isRefundWorkflowStage,
} from "./billing";
export type { BillingDomainModel, RefundWorkflowStage } from "./billing";

export {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_DOMAIN_MODELS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_TICKET_STATUS_PIPELINE,
  isSupportTicketDepartment,
  isSupportTicketPriority,
  isSupportTicketStatus,
} from "./support";
export type {
  SupportTicketDepartmentKey,
  SupportTicketDomainModel,
  SupportTicketPriorityValue,
  SupportTicketStatusValue,
} from "./support";
