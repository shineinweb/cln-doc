import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  PLACEHOLDER_AI_APPROVALS,
  PLACEHOLDER_AI_RUNS,
  PLACEHOLDER_KNOWLEDGE_ARTICLES,
  PLACEHOLDER_LEADS,
  PLACEHOLDER_PRODUCTS,
  PLACEHOLDER_TICKETS,
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
    expect(PLACEHOLDER_AI_RUNS.length).toBeGreaterThan(0);
  });
});
