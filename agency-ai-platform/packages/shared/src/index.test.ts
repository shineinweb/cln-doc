import { describe, expect, it } from "vitest";
import {
  APP_NAMES,
  assertNever,
  COMMERCIAL_LIFECYCLE,
  COMMERCIAL_LIFECYCLE_STAGES,
  isCommercialLifecycleStage,
  PROJECT_DELIVERY_MODELS,
  PROJECT_STATUS_PIPELINE,
  PROJECT_STATUS_STAGES,
  WEBSITE_DEVELOPMENT_PACKAGE,
  BILLING_DOMAIN_MODELS,
  QUOTE_CUSTOMER_ACTIONS,
  REFUND_WORKFLOW,
  REFUND_WORKFLOW_STAGES,
  SUPPORT_TICKET_DOMAIN_MODELS,
  SUPPORT_TICKET_STATUS_PIPELINE,
  SUPPORT_TICKET_STATUSES,
  canPerformQuoteAction,
  formatUsdFromCents,
  isProjectStatusStage,
  isRefundWorkflowStage,
  isSupportTicketStatus,
  nextQuoteStatusAfterAction,
} from "./index";

describe("APP_NAMES", () => {
  it("exposes stable app identifiers", () => {
    expect(APP_NAMES.api).toBe("api");
    expect(APP_NAMES.website).toBe("website");
  });
});

describe("assertNever", () => {
  it("throws for exhaustive-check failures", () => {
    expect(() => assertNever("x" as never)).toThrow(/Unexpected value/);
  });
});

describe("COMMERCIAL_LIFECYCLE", () => {
  it("encodes Lead through Recurring Services in order", () => {
    expect(COMMERCIAL_LIFECYCLE_STAGES).toEqual([
      "lead",
      "opportunity",
      "quote",
      "customer",
      "project",
      "invoice",
      "recurring_services",
    ]);
    expect(COMMERCIAL_LIFECYCLE.map((step) => step.label)).toEqual([
      "Lead",
      "Opportunity",
      "Quote",
      "Customer",
      "Project",
      "Invoice",
      "Recurring Services",
    ]);
    expect(isCommercialLifecycleStage("quote")).toBe(true);
    expect(isCommercialLifecycleStage("unknown")).toBe(false);
  });
});

describe("PROJECT_DELIVERY_MODELS", () => {
  it("lists Project through ProjectActivity", () => {
    expect(PROJECT_DELIVERY_MODELS).toEqual([
      "Project",
      "Milestone",
      "Task",
      "Subtask",
      "Comment",
      "Attachment",
      "TimeEntry",
      "ProjectMember",
      "ProjectActivity",
    ]);
  });
});

describe("PROJECT_STATUS_PIPELINE", () => {
  it("encodes New through Maintenance in order", () => {
    expect(PROJECT_STATUS_STAGES).toEqual([
      "NEW",
      "PLANNING",
      "DESIGN",
      "DEVELOPMENT",
      "CUSTOMER_REVIEW",
      "REVISION",
      "QA",
      "LAUNCH",
      "MAINTENANCE",
    ]);
    expect(PROJECT_STATUS_PIPELINE.map((step) => step.label)).toEqual([
      "New",
      "Planning",
      "Design",
      "Development",
      "Customer Review",
      "Revision",
      "QA",
      "Launch",
      "Maintenance",
    ]);
    expect(isProjectStatusStage("QA")).toBe(true);
    expect(isProjectStatusStage("ACTIVE")).toBe(false);
  });
});

describe("WEBSITE_DEVELOPMENT_PACKAGE", () => {
  it("totals one-time and monthly line items correctly", () => {
    const oneTime = WEBSITE_DEVELOPMENT_PACKAGE.oneTimeLines.reduce(
      (sum, line) => sum + line.amountCents,
      0,
    );
    const monthly = WEBSITE_DEVELOPMENT_PACKAGE.monthlyLines.reduce(
      (sum, line) => sum + line.amountCents,
      0,
    );
    expect(oneTime).toBe(950_000);
    expect(monthly).toBe(24_800);
    expect(WEBSITE_DEVELOPMENT_PACKAGE.projectTotalCents).toBe(oneTime);
    expect(WEBSITE_DEVELOPMENT_PACKAGE.monthlyTotalCents).toBe(monthly);
    expect(formatUsdFromCents(950_000)).toBe("$9,500");
    expect(formatUsdFromCents(24_800, { monthly: true })).toBe("$248/mo");
  });
});

describe("QUOTE_CUSTOMER_ACTIONS", () => {
  it("exposes View, Accept, Reject, Request changes", () => {
    expect(QUOTE_CUSTOMER_ACTIONS.map((item) => item.label)).toEqual([
      "View",
      "Accept",
      "Reject",
      "Request changes",
    ]);
    expect(canPerformQuoteAction("SENT", "accept")).toBe(true);
    expect(canPerformQuoteAction("DRAFT", "accept")).toBe(false);
    expect(canPerformQuoteAction("SENT", "view")).toBe(true);
    expect(nextQuoteStatusAfterAction("accept")).toBe("ACCEPTED");
    expect(nextQuoteStatusAfterAction("reject")).toBe("REJECTED");
    expect(nextQuoteStatusAfterAction("request_changes")).toBe("CHANGES_REQUESTED");
  });
});

describe("BILLING_DOMAIN", () => {
  it("lists Products through Webhooks and refund workflow", () => {
    expect(BILLING_DOMAIN_MODELS).toEqual([
      "Product",
      "Price",
      "Invoice",
      "Subscription",
      "Payment",
      "Refund",
      "WebhookEvent",
    ]);
    expect(REFUND_WORKFLOW_STAGES[0]).toBe("REQUESTED");
    expect(REFUND_WORKFLOW_STAGES).toContain("SUCCEEDED");
    expect(REFUND_WORKFLOW.map((step) => step.label)).toContain("Pending approval");
    expect(isRefundWorkflowStage("APPROVED")).toBe(true);
    expect(isRefundWorkflowStage("PAID")).toBe(false);
  });
});

describe("SUPPORT_TICKET_DOMAIN", () => {
  it("lists SupportTicket through TicketStatusHistory and status pipeline", () => {
    expect(SUPPORT_TICKET_DOMAIN_MODELS).toEqual([
      "SupportTicket",
      "TicketMessage",
      "TicketAttachment",
      "TicketAssignment",
      "TicketStatusHistory",
    ]);
    expect(SUPPORT_TICKET_STATUSES).toEqual([
      "OPEN",
      "IN_PROGRESS",
      "WAITING_ON_CUSTOMER",
      "WAITING_ON_US",
      "RESOLVED",
      "CLOSED",
    ]);
    expect(SUPPORT_TICKET_STATUS_PIPELINE.map((step) => step.label)).toEqual([
      "Open",
      "In progress",
      "Waiting on customer",
      "Waiting on us",
      "Resolved",
      "Closed",
    ]);
    expect(isSupportTicketStatus("OPEN")).toBe(true);
    expect(isSupportTicketStatus("DONE")).toBe(false);
  });
});
