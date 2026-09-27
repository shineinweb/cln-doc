/**
 * Canonical billing domain for the Agency AI Platform.
 *
 * Products · Prices · Invoices · Subscriptions · Payments · Refund workflow · Webhooks
 */
export const BILLING_DOMAIN_MODELS = [
  "Product",
  "Price",
  "Invoice",
  "Subscription",
  "Payment",
  "Refund",
  "WebhookEvent",
] as const;

export type BillingDomainModel = (typeof BILLING_DOMAIN_MODELS)[number];

/**
 * Refund workflow:
 * Requested → Pending approval → Approved → Processing → Succeeded
 *                                ↘ Denied / Failed / Canceled
 */
export const REFUND_WORKFLOW_STAGES = [
  "REQUESTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "DENIED",
  "CANCELED",
] as const;

export type RefundWorkflowStage = (typeof REFUND_WORKFLOW_STAGES)[number];

export const REFUND_WORKFLOW = [
  { status: "REQUESTED", label: "Requested", description: "Customer or staff opened a refund." },
  {
    status: "PENDING_APPROVAL",
    label: "Pending approval",
    description: "Awaiting billing/staff authorization.",
  },
  { status: "APPROVED", label: "Approved", description: "Authorized to send to PaymentProvider." },
  { status: "PROCESSING", label: "Processing", description: "Provider is executing the refund." },
  { status: "SUCCEEDED", label: "Succeeded", description: "Funds returned successfully." },
  { status: "FAILED", label: "Failed", description: "Provider reported a failure." },
  { status: "DENIED", label: "Denied", description: "Staff denied the refund request." },
  { status: "CANCELED", label: "Canceled", description: "Request canceled before completion." },
] as const;

export function isRefundWorkflowStage(value: string): value is RefundWorkflowStage {
  return (REFUND_WORKFLOW_STAGES as readonly string[]).includes(value);
}
