import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import {
  COMMERCIAL_LIFECYCLE,
  COMMERCIAL_LIFECYCLE_STAGES,
  PROJECT_DELIVERY_MODELS,
  PROJECT_STATUS_STAGES,
  QUOTE_CUSTOMER_ACTIONS,
  QUOTE_STATUSES,
} from "@agency/shared";

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

const IDENTITY_MODELS = [
  "User",
  "Session",
  "Organization",
  "OrganizationMember",
  "Role",
  "Permission",
  "RolePermission",
  "Customer",
  "CustomerContact",
  "AuditLog",
  "AuthToken",
  "UserRole",
] as const;

const LIFECYCLE_MODELS = [
  "Lead",
  "LeadActivity",
  "Opportunity",
  "Quote",
  "QuoteLineItem",
  "Project",
  "Invoice",
  "InvoiceLineItem",
  "Subscription",
  "SubscriptionItem",
] as const;

const DELIVERY_MODELS = [
  "Milestone",
  "Task",
  "Subtask",
  "Comment",
  "Attachment",
  "TimeEntry",
  "ProjectMember",
  "ProjectActivity",
] as const;

describe("Prisma MariaDB schema", () => {
  const schema = readFileSync(schemaPath, "utf8");

  it("uses mysql provider and DATABASE_URL", () => {
    expect(schema).toMatch(/datasource\s+db\s*\{[^}]*provider\s*=\s*"mysql"/s);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).not.toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).not.toMatch(/pgvector/i);
  });

  it("declares identity, lifecycle, and delivery models", () => {
    for (const model of [...IDENTITY_MODELS, ...LIFECYCLE_MODELS, ...DELIVERY_MODELS]) {
      expect(schema).toContain(`model ${model}`);
    }
  });

  it("documents the Lead → Recurring Services lifecycle", () => {
    expect(schema).toContain(
      "Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services",
    );
    expect(COMMERCIAL_LIFECYCLE_STAGES).toEqual([
      "lead",
      "opportunity",
      "quote",
      "customer",
      "project",
      "invoice",
      "recurring_services",
    ]);
    expect(COMMERCIAL_LIFECYCLE.map((step) => step.model)).toEqual([
      "Lead",
      "Opportunity",
      "Quote",
      "Customer",
      "Project",
      "Invoice",
      "Subscription",
    ]);
  });

  it("documents the Project delivery hierarchy", () => {
    expect(schema).toContain("Project → Milestone → Task → Subtask (+ Comment, Attachment,");
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

  it("documents the Project status pipeline New → Maintenance", () => {
    expect(schema).toContain(
      "New → Planning → Design → Development → Customer Review → Revision → QA → Launch → Maintenance",
    );
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
    expect(schema).toMatch(/status\s+ProjectStatus\s+@default\(NEW\)/);
  });

  it("documents quote customer actions View · Accept · Reject · Request changes", () => {
    expect(schema).toContain("View · Accept · Reject · Request changes");
    expect(schema).toContain("CHANGES_REQUESTED");
    expect(schema).toContain("viewedAt");
    expect(schema).toContain("changesRequestedAt");
    expect(QUOTE_STATUSES).toContain("CHANGES_REQUESTED");
    expect(QUOTE_CUSTOMER_ACTIONS.map((item) => item.label)).toEqual([
      "View",
      "Accept",
      "Reject",
      "Request changes",
    ]);
  });

  it("exposes generated model delegates on Prisma client DMMF", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);
    expect(modelNames).toEqual(
      expect.arrayContaining([...IDENTITY_MODELS, ...LIFECYCLE_MODELS, ...DELIVERY_MODELS]),
    );
  });
});
