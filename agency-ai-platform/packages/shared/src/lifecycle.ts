/**
 * Canonical commercial lifecycle for the Agency AI Platform.
 *
 * Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services
 */
export const COMMERCIAL_LIFECYCLE_STAGES = [
  "lead",
  "opportunity",
  "quote",
  "customer",
  "project",
  "invoice",
  "recurring_services",
] as const;

export type CommercialLifecycleStage = (typeof COMMERCIAL_LIFECYCLE_STAGES)[number];

export const COMMERCIAL_LIFECYCLE = [
  {
    stage: "lead",
    label: "Lead",
    description: "Inbound interest — unqualified contact or quote request.",
    model: "Lead",
  },
  {
    stage: "opportunity",
    label: "Opportunity",
    description: "Qualified deal in the sales pipeline.",
    model: "Opportunity",
  },
  {
    stage: "quote",
    label: "Quote",
    description: "Formal priced proposal with line items.",
    model: "Quote",
  },
  {
    stage: "customer",
    label: "Customer",
    description: "Accepted commercial relationship (Organization + Customer).",
    model: "Customer",
  },
  {
    stage: "project",
    label: "Project",
    description: "Delivery container for scoped work.",
    model: "Project",
  },
  {
    stage: "invoice",
    label: "Invoice",
    description: "Billable amount for project or one-time services.",
    model: "Invoice",
  },
  {
    stage: "recurring_services",
    label: "Recurring Services",
    description: "Ongoing hosting, retainers, and maintenance (Subscription).",
    model: "Subscription",
  },
] as const;

export function isCommercialLifecycleStage(value: string): value is CommercialLifecycleStage {
  return (COMMERCIAL_LIFECYCLE_STAGES as readonly string[]).includes(value);
}
