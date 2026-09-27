import { describe, expect, it } from "vitest";
import {
  getPlatformRole,
  isStaffRoleKey,
  PLATFORM_PERMISSION_KEYS,
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLE_KEYS,
  PLATFORM_ROLES,
} from "./roles";

describe("platform roles catalog", () => {
  it("includes the eleven required roles", () => {
    expect(PLATFORM_ROLE_KEYS).toEqual([
      "super_admin",
      "administrator",
      "manager",
      "sales",
      "developer",
      "designer",
      "seo_specialist",
      "hosting_technician",
      "support_agent",
      "billing",
      "customer",
    ]);
  });

  it("uses the canonical permission keys", () => {
    expect(PLATFORM_PERMISSION_KEYS).toEqual([
      "customers.view",
      "customers.create",
      "customers.edit",
      "customers.delete",
      "projects.view",
      "projects.create",
      "projects.edit",
      "hosting.view",
      "hosting.create",
      "hosting.suspend",
      "domains.view",
      "domains.manage",
      "billing.view",
      "billing.refund",
      "ai.use",
      "ai.manage",
      "ai.approve",
      "users.manage",
      "roles.manage",
    ]);
  });

  it("gives super admin unrestricted access", () => {
    expect(getPlatformRole("super_admin").permissions).toEqual(["*"]);
    expect(getPlatformRole("customer").isStaff).toBe(false);
    expect(isStaffRoleKey("developer")).toBe(true);
  });

  it("references only declared permission keys (or *)", () => {
    const declared = new Set(PLATFORM_PERMISSIONS.map((permission) => permission.key));
    for (const role of PLATFORM_ROLES) {
      for (const permission of role.permissions) {
        if (permission === "*") continue;
        expect(declared.has(permission)).toBe(true);
      }
    }
  });
});
