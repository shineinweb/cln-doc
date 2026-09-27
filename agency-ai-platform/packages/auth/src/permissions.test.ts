import { describe, expect, it } from "vitest";
import { hasAllPermissions, hasPermission } from "./permissions";

describe("permissions", () => {
  it("matches exact and wildcard grants", () => {
    expect(hasPermission(["crm.leads.read"], "crm.leads.read")).toBe(true);
    expect(hasPermission(["crm.*"], "crm.leads.write")).toBe(true);
    expect(hasPermission(["crm.leads.read"], "billing.refunds.create")).toBe(false);
  });

  it("requires all listed permissions", () => {
    expect(hasAllPermissions(["a", "b"], ["a", "b"])).toBe(true);
    expect(hasAllPermissions(["a"], ["a", "b"])).toBe(false);
  });
});
