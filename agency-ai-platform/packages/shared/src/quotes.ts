/**
 * Canonical customer quote actions for the Agency AI Platform.
 *
 * View → Accept | Reject | Request changes
 */
export const QUOTE_CUSTOMER_ACTIONS = [
  {
    action: "view",
    label: "View",
    description: "Open and review the quote details.",
    resultingStatus: null,
  },
  {
    action: "accept",
    label: "Accept",
    description: "Accept the quote and proceed toward customer / project.",
    resultingStatus: "ACCEPTED",
  },
  {
    action: "reject",
    label: "Reject",
    description: "Decline the quote.",
    resultingStatus: "REJECTED",
  },
  {
    action: "request_changes",
    label: "Request changes",
    description: "Ask for revisions before deciding.",
    resultingStatus: "CHANGES_REQUESTED",
  },
] as const;

export type QuoteCustomerAction = (typeof QUOTE_CUSTOMER_ACTIONS)[number]["action"];

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "CHANGES_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;

export type QuoteStatusValue = (typeof QUOTE_STATUSES)[number];

/** Statuses where the customer may Accept / Reject / Request changes. */
export const QUOTE_ACTIONABLE_STATUSES = ["SENT", "CHANGES_REQUESTED"] as const;

export function isQuoteCustomerAction(value: string): value is QuoteCustomerAction {
  return QUOTE_CUSTOMER_ACTIONS.some((item) => item.action === value);
}

export function canPerformQuoteAction(status: string, action: QuoteCustomerAction): boolean {
  if (action === "view") return status !== "DRAFT";
  return (QUOTE_ACTIONABLE_STATUSES as readonly string[]).includes(status);
}

export function nextQuoteStatusAfterAction(
  action: Exclude<QuoteCustomerAction, "view">,
): QuoteStatusValue {
  switch (action) {
    case "accept":
      return "ACCEPTED";
    case "reject":
      return "REJECTED";
    case "request_changes":
      return "CHANGES_REQUESTED";
  }
}
