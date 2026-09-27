import { describe, expect, it } from "vitest";
import {
  assertOrganizationAccess,
  canAccessOrganization,
  membershipOrganizationIds,
  OrganizationAccessError,
} from "./tenant";
import type { AuthUserView } from "./types";

function customer(id: string, organizationIds: string[]): AuthUserView {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    isStaff: false,
    emailVerified: true,
    roles: ["customer"],
    permissions: ["ai.use", "portal.*"],
    memberships: organizationIds.map((organizationId) => ({
      organizationId,
      organizationName: organizationId,
      organizationSlug: organizationId,
      role: "OWNER" as const,
    })),
  };
}

describe("tenant isolation", () => {
  it("Customer A cannot access Customer B organization", () => {
    const customerA = customer("user_a", ["org_a"]);
    const customerB = customer("user_b", ["org_b"]);

    expect(canAccessOrganization(customerA, "org_a")).toBe(true);
    expect(canAccessOrganization(customerA, "org_b")).toBe(false);
    expect(canAccessOrganization(customerB, "org_a")).toBe(false);

    expect(() => assertOrganizationAccess(customerA, "org_b")).toThrow(OrganizationAccessError);
    expect(() => assertOrganizationAccess(customerB, "org_a")).toThrow(OrganizationAccessError);
    expect(() => assertOrganizationAccess(customerA, "org_a")).not.toThrow();
  });

  it("lists membership organization ids for scoping queries", () => {
    const user = customer("user_a", ["org_a", "org_shared"]);
    expect(membershipOrganizationIds(user.memberships)).toEqual(["org_a", "org_shared"]);
  });
});
