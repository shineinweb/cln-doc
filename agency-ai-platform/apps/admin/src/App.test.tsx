import { describe, expect, it } from "vitest";
import { ADMIN_AI_SECTIONS } from "@agency/ai";
import {
  ADMIN_NAV,
  PLACEHOLDER_AI_APPROVALS,
  PLACEHOLDER_AI_EXECUTIONS,
  PLACEHOLDER_AI_RUNS,
  PLACEHOLDER_AI_SECURITY_EVENTS,
  PLACEHOLDER_KNOWLEDGE_ARTICLES,
  PLACEHOLDER_LEADS,
  PLACEHOLDER_PRODUCTS,
  PLACEHOLDER_TICKETS,
  PLACEHOLDER_TODAY_DASHBOARD,
} from "./data/placeholders";

describe("admin CRM and billing routes catalog", () => {
  it("exposes CRM, support, knowledge, AI, and billing admin paths", () => {
    const paths = ADMIN_NAV.map((item) => item.to);
    expect(paths).toContain("/admin/leads");
    expect(paths).toContain("/admin/customers");
    expect(paths).toContain("/admin/opportunities");
    expect(paths).toContain("/admin/quotes");
    expect(paths).toContain("/admin/tickets");
    expect(paths).toContain("/admin/knowledge");
    expect(paths).toContain("/admin/sops");
    expect(paths).toContain("/admin/ai");
    expect(paths).toContain("/admin/products");
    expect(paths).toContain("/admin/prices");
    expect(paths).toContain("/admin/invoices");
    expect(paths).toContain("/admin/subscriptions");
    expect(paths).toContain("/admin/payments");
    expect(paths).toContain("/admin/refunds");
    expect(paths).toContain("/admin/webhooks");
    expect(PLACEHOLDER_LEADS.length).toBeGreaterThan(0);
    expect(PLACEHOLDER_PRODUCTS.some((product) => product.key === "hosting")).toBe(true);
    expect(PLACEHOLDER_TICKETS.some((ticket) => ticket.status === "OPEN")).toBe(true);
    expect(PLACEHOLDER_KNOWLEDGE_ARTICLES.some((article) => article.status === "PUBLISHED")).toBe(
      true,
    );
    expect(PLACEHOLDER_AI_APPROVALS.some((item) => item.status === "pending")).toBe(true);
    expect(PLACEHOLDER_AI_EXECUTIONS[0]?.number).toBe(18_552);
    expect(PLACEHOLDER_AI_EXECUTIONS[0]?.requestedToolName).toBe("renewCertificate");
    expect(PLACEHOLDER_AI_RUNS.length).toBeGreaterThan(0);
    expect(ADMIN_AI_SECTIONS).toHaveLength(11);
    expect(ADMIN_AI_SECTIONS.map((s) => `/admin/ai/${s.path}`)).toContain(
      "/admin/ai/security-events",
    );
    expect(PLACEHOLDER_AI_SECURITY_EVENTS.some((e) => e.kind === "forbidden_path")).toBe(true);
  });

  it("exposes TODAY dashboard metrics and pipeline sections", () => {
    expect(PLACEHOLDER_TODAY_DASHBOARD.today.map((row) => row.label)).toEqual([
      "Revenue",
      "MRR",
      "Customers",
      "Open Projects",
      "Open Tickets",
      "Domains",
      "Hosting Accounts",
    ]);
    expect(PLACEHOLDER_TODAY_DASHBOARD.salesPipeline.map((s) => s.label)).toEqual([
      "New Leads",
      "Quotes",
      "Won",
    ]);
    expect(PLACEHOLDER_TODAY_DASHBOARD.projects.map((s) => s.label)).toEqual([
      "Design",
      "Development",
      "Customer Review",
      "Launch",
    ]);
    expect(PLACEHOLDER_TODAY_DASHBOARD.hosting.map((s) => s.label)).toContain("Alerts");
    expect(PLACEHOLDER_TODAY_DASHBOARD.ai.map((s) => s.label)).toEqual([
      "Conversations",
      "Resolved",
      "Escalated",
      "Approvals",
      "Cost",
    ]);
  });
});
