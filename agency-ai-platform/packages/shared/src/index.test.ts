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
  formatUsdFromCents,
  isProjectStatusStage,
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
