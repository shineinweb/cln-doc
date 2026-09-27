/**
 * Production-readiness integration checks across authz, tenancy, AI, and webhooks.
 */
import { describe, expect, it } from "vitest";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  assertOrganizationAccess,
  OrganizationAccessError,
  permissionsForPlatformRole,
  SESSION_COOKIE_NAME,
  type AuthUserView,
} from "@agency/auth";
import {
  authorizeRefundIssuance,
  AuthorizationError,
  signStripeWebhookPayload,
  StripePaymentProvider,
  StripeWebhookSignatureError,
} from "@agency/billing";
import {
  AiApprovalRequiredError,
  AiAuthorizationError,
  assertAiActorAuthorized,
  assertToolApprovalGranted,
  createPendingApproval,
  decideToolApproval,
  invokeAuthorizedTool,
} from "@agency/ai";
import { AuthGuard } from "./common/guards/auth.guard";
import { IS_PUBLIC_KEY } from "./common/decorators/public.decorator";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { PERMISSIONS_KEY } from "./common/decorators/permissions.decorator";
import { StaffGuard } from "./common/guards/staff.guard";
import { PortalOrganizationsController } from "./portal/portal-organizations.controller";
import { StripeWebhookController } from "./billing/stripe-webhook.controller";

function portalUser(id: string, organizationId: string): AuthUserView {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    isStaff: false,
    emailVerified: true,
    roles: ["customer"],
    permissions: permissionsForPlatformRole("customer"),
    memberships: [
      {
        organizationId,
        organizationName: organizationId,
        organizationSlug: organizationId,
        role: "OWNER",
      },
    ],
  };
}

describe("production-readiness integration", () => {
  it("Customer A cannot access Customer B", () => {
    const a = portalUser("user_a", "org_a");
    const b = portalUser("user_b", "org_b");
    expect(() => assertOrganizationAccess(a, "org_b")).toThrow(OrganizationAccessError);
    const controller = new PortalOrganizationsController();
    expect(() => controller.getOrganization("org_b", a)).toThrow(NotFoundException);
    expect(() => controller.getOrganization("org_a", b)).toThrow(NotFoundException);
  });

  it("employee without billing.refund cannot issue refunds", () => {
    expect(() =>
      authorizeRefundIssuance({
        actorPermissions: permissionsForPlatformRole("support_agent"),
        paymentExternalId: "pi_1",
        amountCents: 100,
        idempotencyKey: "idem_1",
      }),
    ).toThrow(AuthorizationError);

    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PERMISSIONS_KEY ? ["billing.refund"] : undefined,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            auth: { user: { permissions: permissionsForPlatformRole("support_agent") } },
          }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it("customer cannot access admin APIs", () => {
    const staffGuard = new StaffGuard();
    expect(() =>
      staffGuard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            auth: { user: portalUser("user_a", "org_a") },
          }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it("AI cannot bypass authorization", () => {
    expect(() =>
      assertAiActorAuthorized(
        {
          userId: "user_a",
          permissions: [],
          membershipOrganizationIds: ["org_a"],
          isStaff: false,
        },
        { organizationId: "org_a", userId: "user_a" },
      ),
    ).toThrow(AiAuthorizationError);

    expect(() =>
      assertAiActorAuthorized(
        {
          userId: "user_a",
          permissions: ["ai.use"],
          membershipOrganizationIds: ["org_a"],
          isStaff: false,
        },
        { organizationId: "org_b", userId: "user_a" },
      ),
    ).toThrow(AiAuthorizationError);
  });

  it("AI cannot execute approval-required tools without approval", async () => {
    expect(() => assertToolApprovalGranted("createPullRequests", "write", true, undefined)).toThrow(
      AiApprovalRequiredError,
    );

    const pending = createPendingApproval({
      toolName: "createPullRequests",
      risk: "write",
      rationale: "Open PR",
    });
    await expect(
      invokeAuthorizedTool(
        "createPullRequests",
        { title: "feat" },
        { organizationId: "org_a", userId: "user_a", projectId: "proj_1" },
        {
          actor: {
            userId: "user_a",
            permissions: ["ai.use"],
            membershipOrganizationIds: ["org_a"],
            isStaff: false,
          },
          approval: pending,
        },
      ),
    ).rejects.toBeInstanceOf(AiApprovalRequiredError);

    const approved = decideToolApproval(pending, "approved", "admin_1");
    expect(() =>
      assertToolApprovalGranted("createPullRequests", "write", true, approved),
    ).not.toThrow();
  });

  it("invalid Stripe webhooks are rejected", async () => {
    const provider = new StripePaymentProvider({ webhookSecret: "whsec_int" });
    await expect(
      provider.parseWebhook({ "stripe-signature": "t=1,v1=bad" }, '{"id":"evt","type":"x"}'),
    ).rejects.toBeInstanceOf(StripeWebhookSignatureError);

    const controller = new StripeWebhookController(provider);
    await expect(
      controller.handleStripe({ rawBody: '{"id":"evt","type":"x"}' } as never, {
        "stripe-signature": "t=1,v1=bad",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const rawBody = JSON.stringify({ id: "evt_ok", type: "ping" });
    const ts = Math.floor(Date.now() / 1000);
    await expect(
      provider.parseWebhook(
        {
          "stripe-signature": signStripeWebhookPayload({
            rawBody,
            webhookSecret: "whsec_int",
            timestamp: ts,
          }),
        },
        rawBody,
      ),
    ).resolves.toMatchObject({ externalId: "evt_ok" });
  });

  it("invalid authentication sessions are rejected", async () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? false : undefined),
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector, {
      resolveSession: async () => null,
    } as never);

    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            cookies: { [SESSION_COOKIE_NAME]: "invalid" },
          }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
