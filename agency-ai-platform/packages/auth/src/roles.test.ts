import { describe, expect, it } from "vitest";
import {
  getPlatformRole,
  isStaffRoleKey,
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
    expect(PLATFORM_ROLES.map((role) => role.name)).toEqual([
      "Super Admin",
      "Administrator",
      "Manager",
      "Sales",
      "Developer",
      "Designer",
      "SEO Specialist",
      "Hosting Technician",
      "Support Agent",
      "Billing",
      "Customer",
    ]);
  });

  it("gives super admin unrestricted access and customer portal-only access", () => {
    expect(getPlatformRole("super_admin").permissions).toEqual(["*"]);
    expect(getPlatformRole("customer").permissions).toEqual(["portal.*"]);
    expect(getPlatformRole("customer").isStaff).toBe(false);
    expect(isStaffRoleKey("developer")).toBe(true);
    expect(isStaffRoleKey("customer")).toBe(false);
  });

  it("references only declared permission keys", () => {
    const declared = new Set(PLATFORM_PERMISSIONS.map((permission) => permission.key));
    for (const role of PLATFORM_ROLES) {
      for (const permission of role.permissions) {
        expect(declared.has(permission)).toBe(true);
      }
    }
  });
});
