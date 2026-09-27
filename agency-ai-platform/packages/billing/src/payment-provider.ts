/**
 * PaymentProvider — Stripe (and future adapters) implement this interface.
 * Nest controllers and React apps must not call vendor SDKs directly.
 */

export type Money = {
  amountCents: number;
  currency: string;
};

export type ProviderRef = {
  provider: string;
  externalId: string;
};

export type CreateCheckoutInput = {
  organizationId: string;
  invoiceId?: string;
  subscriptionPriceKeys?: string[];
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
};

export type CreateCheckoutResult = ProviderRef & {
  checkoutUrl: string;
};

export type CreateRefundInput = {
  paymentExternalId: string;
  amountCents: number;
  reason?: string;
  idempotencyKey: string;
};

export type CreateRefundResult = ProviderRef & {
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
};

export type ParsedWebhook = {
  eventType: string;
  externalId: string;
  payload: unknown;
};

export interface PaymentProvider {
  readonly name: string;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;
  /** Verify signature and parse into a domain webhook event (idempotent by externalId). */
  parseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<ParsedWebhook>;
}
