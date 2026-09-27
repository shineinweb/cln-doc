import { describe, expect, it } from "vitest";
import {
  assertCanIssueRefund,
  assertPermission,
  assertStaff,
  AuthorizationError,
  canIssueRefund,
  permissionsForPlatformRole,
} from "./authorization";

describe("authorization", () => {
  it("employee without billing.refund cannot issue refunds", () => {
    const supportAgent = permissionsForPlatformRole("support_agent");
    const billingStaff = permissionsForPlatformRole("billing");

    expect(canIssueRefund(supportAgent)).toBe(false);
    expect(supportAgent.includes("billing.refund")).toBe(false);
    expect(() => assertCanIssueRefund(supportAgent)).toThrow(AuthorizationError);

    expect(canIssueRefund(billingStaff)).toBe(true);
    expect(() => assertCanIssueRefund(billingStaff)).not.toThrow();
  });

  it("customer is not staff and lacks admin permissions", () => {
    const customer = permissionsForPlatformRole("customer");
    expect(customer).toEqual(["ai.use"]);
    expect(() => assertPermission(customer, "customers.view")).toThrow(AuthorizationError);
    expect(() => assertStaff({ id: "user_customer", isStaff: false })).toThrow(AuthorizationError);
    expect(() => assertStaff({ id: "user_staff", isStaff: true })).not.toThrow();
  });
});
