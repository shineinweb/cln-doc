import { describe, expect, it } from "vitest";
import { AuthorizationError, permissionsForPlatformRole } from "@agency/auth";
import { authorizeRefundIssuance } from "./refund-authorization";

describe("refund authorization", () => {
  it("employee without billing.refund cannot issue refunds", () => {
    const supportAgent = permissionsForPlatformRole("support_agent");
    expect(() =>
      authorizeRefundIssuance({
        actorPermissions: supportAgent,
        paymentExternalId: "pi_123",
        amountCents: 1000,
        idempotencyKey: "idem_1",
      }),
    ).toThrow(AuthorizationError);

    expect(() =>
      authorizeRefundIssuance({
        actorPermissions: permissionsForPlatformRole("billing"),
        paymentExternalId: "pi_123",
        amountCents: 1000,
        idempotencyKey: "idem_1",
      }),
    ).not.toThrow();
  });
});
