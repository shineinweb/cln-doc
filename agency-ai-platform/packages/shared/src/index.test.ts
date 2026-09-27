import { describe, expect, it } from "vitest";
import {
  APP_NAMES,
  assertNever,
  COMMERCIAL_LIFECYCLE,
  COMMERCIAL_LIFECYCLE_STAGES,
  isCommercialLifecycleStage,
  PROJECT_DELIVERY_MODELS,
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
