import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { permissionsForPlatformRole, type AuthUserView } from "@agency/auth";
import type { PaymentProvider } from "@agency/billing";
import { RefundsService } from "./refunds.service";

function staffUser(permissions: string[]): AuthUserView {
  return {
    id: "user_staff",
    email: "staff@example.com",
    name: "Staff",
    isStaff: true,
    emailVerified: true,
    memberships: [],
    roles: [],
    permissions,
  };
}

describe("refunds authorization API", () => {
  it("employee without billing.refund cannot issue refunds", async () => {
    const createRefund = vi.fn(async () => ({
      provider: "stripe",
      externalId: "re_1",
      status: "SUCCEEDED" as const,
    }));
    const provider: PaymentProvider = {
      name: "stripe",
      createCheckoutSession: vi.fn(),
      createRefund,
      parseWebhook: vi.fn(),
    };
    const service = new RefundsService(provider);

    await expect(
      service.issueRefund(staffUser(permissionsForPlatformRole("support_agent")), {
        paymentExternalId: "pi_1",
        amountCents: 500,
        idempotencyKey: "idem_1",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(createRefund).not.toHaveBeenCalled();

    await expect(
      service.issueRefund(staffUser(permissionsForPlatformRole("billing")), {
        paymentExternalId: "pi_1",
        amountCents: 500,
        idempotencyKey: "idem_1",
      }),
    ).resolves.toMatchObject({ externalId: "re_1" });
    expect(createRefund).toHaveBeenCalledOnce();
  });
});
