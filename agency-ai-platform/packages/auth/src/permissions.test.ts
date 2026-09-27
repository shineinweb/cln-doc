import { describe, expect, it } from "vitest";
import { hasAllPermissions, hasPermission } from "./permissions";

describe("permissions", () => {
  it("matches exact and wildcard grants", () => {
    expect(hasPermission(["customers.view"], "customers.view")).toBe(true);
    expect(hasPermission(["customers.*"], "customers.edit")).toBe(true);
    expect(hasPermission(["*"], "roles.manage")).toBe(true);
    expect(hasPermission(["customers.view"], "billing.refund")).toBe(false);
  });

  it("requires all listed permissions", () => {
    expect(hasAllPermissions(["customers.view", "billing.view"], ["customers.view"])).toBe(true);
    expect(hasAllPermissions(["customers.view"], ["customers.view", "billing.refund"])).toBe(false);
  });
});
