import { describe, expect, it } from "vitest";
import { ADMIN_NAV, PLACEHOLDER_LEADS } from "./data/placeholders";

describe("admin CRM routes catalog", () => {
  it("exposes the requested admin CRM paths", () => {
    const paths = ADMIN_NAV.map((item) => item.to);
    expect(paths).toContain("/admin/leads");
    expect(paths).toContain("/admin/customers");
    expect(paths).toContain("/admin/opportunities");
    expect(paths).toContain("/admin/quotes");
    expect(PLACEHOLDER_LEADS.length).toBeGreaterThan(0);
  });
});
