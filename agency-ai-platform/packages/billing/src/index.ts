/** Billing package — catalog helpers, invoices, PaymentProvider adapters. */
export type PlanId = "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyCents: number;
};

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", monthlyCents: 9900 },
  { id: "growth", name: "Growth", monthlyCents: 24900 },
  { id: "scale", name: "Scale", monthlyCents: 59900 },
];

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}

export type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateRefundInput,
  CreateRefundResult,
  Money,
  ParsedWebhook,
  PaymentProvider,
  ProviderRef,
} from "./payment-provider";

export {
  signStripeWebhookPayload,
  StripeWebhookSignatureError,
  verifyStripeWebhookSignature,
} from "./stripe-webhook";
export type { VerifyStripeWebhookOptions } from "./stripe-webhook";

export { StripePaymentProvider } from "./stripe-payment-provider";
export type { StripePaymentProviderOptions } from "./stripe-payment-provider";

export {
  assertCanIssueRefund,
  authorizeRefundIssuance,
  AuthorizationError,
  canIssueRefund,
} from "./refund-authorization";
export type { IssueRefundCommand } from "./refund-authorization";
