import { describe, expect, it } from "vitest";
import { createPendingApproval, decideToolApproval } from "../approvals";
import {
  AiApprovalRequiredError,
  assertToolApprovalGranted,
  invokeAuthorizedTool,
} from "../tools/authorized-invoke";
import { AiAuthorizationError, assertAiActorAuthorized, type AiActor } from "./authorization";

function actor(overrides: Partial<AiActor> = {}): AiActor {
  return {
    userId: "user_a",
    permissions: ["ai.use"],
    membershipOrganizationIds: ["org_a"],
    isStaff: false,
    ...overrides,
  };
}

describe("AI authorization", () => {
  it("AI cannot bypass authorization (missing ai.use / wrong user / cross-tenant)", () => {
    const ctx = { organizationId: "org_a", userId: "user_a" };

    expect(() => assertAiActorAuthorized(actor({ permissions: ["portal.*"] }), ctx)).toThrow(
      AiAuthorizationError,
    );

    expect(() => assertAiActorAuthorized(actor({ userId: "user_attacker" }), ctx)).toThrow(
      AiAuthorizationError,
    );

    expect(() =>
      assertAiActorAuthorized(actor({ membershipOrganizationIds: ["org_a"] }), {
        organizationId: "org_b",
        userId: "user_a",
      }),
    ).toThrow(AiAuthorizationError);

    expect(() => assertAiActorAuthorized(actor(), ctx)).not.toThrow();
  });

  it("AI cannot execute approval-required tools without approval", async () => {
    const ctx = { organizationId: "org_a", userId: "user_a" };

    expect(() => assertToolApprovalGranted("renewCertificate", "write", true, null)).toThrow(
      AiApprovalRequiredError,
    );

    const pending = createPendingApproval({
      toolName: "renewCertificate",
      risk: "write",
      rationale: "Renew SSL",
    });
    expect(() => assertToolApprovalGranted("renewCertificate", "write", true, pending)).toThrow(
      AiApprovalRequiredError,
    );

    const approved = decideToolApproval(pending, "approved", "admin_1");
    expect(() =>
      assertToolApprovalGranted("renewCertificate", "write", true, approved),
    ).not.toThrow();

    await expect(
      invokeAuthorizedTool("renewCertificate", { domain: "example.com" }, ctx, {
        actor: actor(),
        approval: null,
      }),
    ).rejects.toBeInstanceOf(AiApprovalRequiredError);

    // With approval, handler is still PLACEHOLDER (unwired) — authz/approval already passed.
    await expect(
      invokeAuthorizedTool("renewCertificate", { domain: "example.com" }, ctx, {
        actor: actor(),
        approval: approved,
      }),
    ).rejects.toThrow(/PLACEHOLDER|unwired/i);
  });
});
