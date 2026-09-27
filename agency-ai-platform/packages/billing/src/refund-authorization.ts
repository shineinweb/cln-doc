/**
 * Refund authorization — billing.refund required before PaymentProvider.createRefund.
 */

import { assertCanIssueRefund, AuthorizationError, canIssueRefund } from "@agency/auth";

export { assertCanIssueRefund, AuthorizationError, canIssueRefund };

export type IssueRefundCommand = {
  actorPermissions: readonly string[];
  paymentExternalId: string;
  amountCents: number;
  reason?: string;
  idempotencyKey: string;
};

/**
 * Gate refund issuance. Call before PaymentProvider.createRefund.
 * Does not weaken checks for AI actors — same permission required.
 */
export function authorizeRefundIssuance(command: IssueRefundCommand): void {
  assertCanIssueRefund(command.actorPermissions);
  if (!Number.isInteger(command.amountCents) || command.amountCents <= 0) {
    throw new AuthorizationError("Refund amountCents must be a positive integer", "INVALID_AMOUNT");
  }
  if (!command.paymentExternalId.trim()) {
    throw new AuthorizationError("paymentExternalId is required", "INVALID_PAYMENT");
  }
  if (!command.idempotencyKey.trim()) {
    throw new AuthorizationError("idempotencyKey is required", "INVALID_IDEMPOTENCY");
  }
}
