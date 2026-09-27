import { describe, expect, it } from "vitest";
import { NotFoundException } from "@nestjs/common";
import type { AuthUserView } from "@agency/auth";
import { PortalOrganizationsController } from "./portal-organizations.controller";

function customer(id: string, organizationId: string): AuthUserView {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    isStaff: false,
    emailVerified: true,
    roles: ["customer"],
    permissions: ["ai.use", "portal.*"],
    memberships: [
      {
        organizationId,
        organizationName: `Org ${organizationId}`,
        organizationSlug: organizationId,
        role: "OWNER",
      },
    ],
  };
}

describe("tenant isolation API", () => {
  it("Customer A cannot access Customer B", () => {
    const controller = new PortalOrganizationsController();
    const customerA = customer("user_a", "org_a");
    const customerB = customer("user_b", "org_b");

    expect(controller.getOrganization("org_a", customerA).data.organizationId).toBe("org_a");
    expect(() => controller.getOrganization("org_b", customerA)).toThrow(NotFoundException);
    expect(() => controller.getOrganization("org_a", customerB)).toThrow(NotFoundException);
  });
});
