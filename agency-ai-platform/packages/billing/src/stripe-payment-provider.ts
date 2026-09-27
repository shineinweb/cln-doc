/**
 * Stripe PaymentProvider adapter — webhook path verifies signatures first.
 * Checkout/refund HTTP calls remain PLACEHOLDER until live Stripe keys are wired.
 */

import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  CreateRefundInput,
  CreateRefundResult,
  ParsedWebhook,
  PaymentProvider,
} from "./payment-provider";
import { StripeWebhookSignatureError, verifyStripeWebhookSignature } from "./stripe-webhook";

export type StripePaymentProviderOptions = {
  webhookSecret: string;
  /** Optional secret key for future Checkout/Refund API calls. */
  secretKey?: string;
  toleranceSeconds?: number;
};

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  constructor(private readonly options: StripePaymentProviderOptions) {}

  async createCheckoutSession(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    throw new Error("StripePaymentProvider.createCheckoutSession is PLACEHOLDER");
  }

  async createRefund(_input: CreateRefundInput): Promise<CreateRefundResult> {
    throw new Error("StripePaymentProvider.createRefund is PLACEHOLDER");
  }

  async parseWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<ParsedWebhook> {
    const signatureHeader =
      headers["stripe-signature"] ?? headers["Stripe-Signature"] ?? headers["STRIPE_SIGNATURE"];

    try {
      verifyStripeWebhookSignature({
        signatureHeader,
        rawBody,
        webhookSecret: this.options.webhookSecret,
        toleranceSeconds: this.options.toleranceSeconds,
      });
    } catch (error) {
      if (error instanceof StripeWebhookSignatureError) {
        throw error;
      }
      throw error;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      throw new StripeWebhookSignatureError(
        "Stripe webhook body is not valid JSON",
        "INVALID_BODY",
      );
    }

    const record = payload as { id?: unknown; type?: unknown };
    if (typeof record.id !== "string" || typeof record.type !== "string") {
      throw new StripeWebhookSignatureError(
        "Stripe webhook payload missing id/type",
        "INVALID_BODY",
      );
    }

    return {
      eventType: record.type,
      externalId: record.id,
      payload,
    };
  }
}
