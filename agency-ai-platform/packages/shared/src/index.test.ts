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
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_DOMAIN_MODELS,
  SUPPORT_TICKET_STATUS_PIPELINE,
  SUPPORT_TICKET_STATUSES,
  KNOWLEDGE_ARTICLE_STATUS_PIPELINE,
  KNOWLEDGE_DOMAIN_MODELS,
  AGENCY_SOPS,
  SOP_CATEGORIES,
  RELEASE_PIPELINE,
  RELEASE_PIPELINE_DIAGRAM,
  RELEASE_PIPELINE_STAGES,
  canCiAutoAdvanceFrom,
  canPerformQuoteAction,
  formatSopLabel,
  formatUsdFromCents,
  getNextReleasePipelineStage,
  getReleasePipelineStage,
  getSopByCode,
  isKnowledgeArticleStatus,
  isProjectStatusStage,
  isRefundWorkflowStage,
  isReleasePipelineStage,
  isSopCategory,
  isSupportTicketDepartment,
  isSupportTicketStatus,
  listSopsByCategory,
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
      "PENDING",
      "CUSTOMER_REPLY",
      "ESCALATED",
      "RESOLVED",
      "CLOSED",
    ]);
    expect(SUPPORT_TICKET_STATUS_PIPELINE.map((step) => step.label)).toEqual([
      "Open",
      "Pending",
      "Customer Reply",
      "Escalated",
      "Resolved",
      "Closed",
    ]);
    expect(isSupportTicketStatus("OPEN")).toBe(true);
    expect(isSupportTicketStatus("DONE")).toBe(false);
    expect(SUPPORT_TICKET_DEPARTMENTS.map((item) => item.label)).toContain("Hosting");
    expect(isSupportTicketDepartment("hosting")).toBe(true);
    expect(isSupportTicketDepartment("sales")).toBe(false);
  });
});

describe("KNOWLEDGE_DOMAIN", () => {
  it("lists KnowledgeArticle through KnowledgeRevision", () => {
    expect(KNOWLEDGE_DOMAIN_MODELS).toEqual([
      "KnowledgeArticle",
      "KnowledgeCategory",
      "KnowledgeDocument",
      "KnowledgeChunk",
      "KnowledgeRevision",
    ]);
    expect(KNOWLEDGE_ARTICLE_STATUS_PIPELINE.map((step) => step.label)).toEqual([
      "Draft",
      "Published",
      "Archived",
    ]);
    expect(isKnowledgeArticleStatus("PUBLISHED")).toBe(true);
    expect(isKnowledgeArticleStatus("LIVE")).toBe(false);
  });
});

describe("AGENCY_SOPS", () => {
  it("catalogs SOP-001 through SOP-030 across seven categories", () => {
    expect(AGENCY_SOPS).toHaveLength(30);
    expect(AGENCY_SOPS[0]?.code).toBe("SOP-001");
    expect(AGENCY_SOPS[29]?.code).toBe("SOP-030");
    expect(SOP_CATEGORIES).toEqual([
      "delivery",
      "domains",
      "hosting",
      "support",
      "billing",
      "security",
      "ai",
    ]);
    expect(getSopByCode("SOP-014")?.title).toBe("SSL");
    expect(getSopByCode("SOP-028")?.title).toBe("AI Tool Approval");
    expect(listSopsByCategory("ai").map((sop) => sop.code)).toEqual([
      "SOP-027",
      "SOP-028",
      "SOP-029",
      "SOP-030",
    ]);
    expect(formatSopLabel(getSopByCode("SOP-001")!)).toBe("SOP-001 Lead Intake");
    expect(isSopCategory("hosting")).toBe(true);
    expect(isSopCategory("marketing")).toBe(false);
  });
});

describe("RELEASE_PIPELINE", () => {
  it("encodes Development → GitHub → Staging → Automated tests → Manual approval → Production", () => {
    expect([...RELEASE_PIPELINE_STAGES]).toEqual([
      "development",
      "github",
      "staging",
      "automated_tests",
      "manual_approval",
      "production",
    ]);
    expect(RELEASE_PIPELINE.map((step) => step.label)).toEqual([
      "Development",
      "GitHub",
      "Staging",
      "Automated tests",
      "Manual approval",
      "Production",
    ]);
    expect(RELEASE_PIPELINE_DIAGRAM).toContain("Manual approval");
    expect(RELEASE_PIPELINE_DIAGRAM).toContain("Production");
    expect(getNextReleasePipelineStage("development")).toBe("github");
    expect(getNextReleasePipelineStage("staging")).toBe("automated_tests");
    expect(getNextReleasePipelineStage("automated_tests")).toBe("manual_approval");
    expect(getNextReleasePipelineStage("manual_approval")).toBe("production");
    expect(getNextReleasePipelineStage("production")).toBeNull();
    expect(getReleasePipelineStage("manual_approval").requiresManualApproval).toBe(true);
    expect(getReleasePipelineStage("production").requiresManualApproval).toBe(true);
    expect(canCiAutoAdvanceFrom("staging")).toBe(true);
    expect(canCiAutoAdvanceFrom("automated_tests")).toBe(false);
    expect(canCiAutoAdvanceFrom("manual_approval")).toBe(false);
    expect(isReleasePipelineStage("github")).toBe(true);
    expect(isReleasePipelineStage("prod")).toBe(false);
  });
});
