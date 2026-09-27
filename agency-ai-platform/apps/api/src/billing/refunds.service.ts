import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  AuthorizationError,
  authorizeRefundIssuance,
  type CreateRefundResult,
  type PaymentProvider,
} from "@agency/billing";
import type { AuthUserView } from "@agency/auth";
import { PAYMENT_PROVIDER } from "./billing.constants";

export type IssueRefundDto = {
  paymentExternalId: string;
  amountCents: number;
  reason?: string;
  idempotencyKey: string;
};

@Injectable()
export class RefundsService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider) {}

  async issueRefund(user: AuthUserView, dto: IssueRefundDto): Promise<CreateRefundResult> {
    try {
      authorizeRefundIssuance({
        actorPermissions: user.permissions,
        paymentExternalId: dto.paymentExternalId,
        amountCents: dto.amountCents,
        reason: dto.reason,
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }

    return this.paymentProvider.createRefund({
      paymentExternalId: dto.paymentExternalId,
      amountCents: dto.amountCents,
      reason: dto.reason,
      idempotencyKey: dto.idempotencyKey,
    });
  }
}
