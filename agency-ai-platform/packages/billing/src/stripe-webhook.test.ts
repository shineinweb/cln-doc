import { describe, expect, it } from "vitest";
import { StripePaymentProvider } from "./stripe-payment-provider";
import {
  signStripeWebhookPayload,
  StripeWebhookSignatureError,
  verifyStripeWebhookSignature,
} from "./stripe-webhook";

const SECRET = "whsec_test_secret";

describe("Stripe webhook verification", () => {
  it("rejects invalid Stripe webhooks", async () => {
    const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const timestamp = 1_700_000_000;

    expect(() =>
      verifyStripeWebhookSignature({
        signatureHeader: undefined,
        rawBody,
        webhookSecret: SECRET,
        nowSeconds: timestamp,
      }),
    ).toThrow(StripeWebhookSignatureError);

    expect(() =>
      verifyStripeWebhookSignature({
        signatureHeader: "t=1,v1=deadbeef",
        rawBody,
        webhookSecret: SECRET,
        nowSeconds: timestamp,
      }),
    ).toThrow(StripeWebhookSignatureError);

    expect(() =>
      verifyStripeWebhookSignature({
        signatureHeader: signStripeWebhookPayload({
          rawBody,
          webhookSecret: SECRET,
          timestamp: timestamp - 10_000,
        }),
        rawBody,
        webhookSecret: SECRET,
        nowSeconds: timestamp,
        toleranceSeconds: 300,
      }),
    ).toThrow(StripeWebhookSignatureError);

    const provider = new StripePaymentProvider({ webhookSecret: SECRET });
    await expect(
      provider.parseWebhook({ "stripe-signature": "t=1,v1=nope" }, rawBody),
    ).rejects.toBeInstanceOf(StripeWebhookSignatureError);
  });

  it("accepts a correctly signed Stripe webhook", async () => {
    const rawBody = JSON.stringify({ id: "evt_ok", type: "checkout.session.completed" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureHeader = signStripeWebhookPayload({
      rawBody,
      webhookSecret: SECRET,
      timestamp,
    });

    expect(
      verifyStripeWebhookSignature({
        signatureHeader,
        rawBody,
        webhookSecret: SECRET,
        nowSeconds: timestamp,
      }).timestamp,
    ).toBe(timestamp);

    const provider = new StripePaymentProvider({ webhookSecret: SECRET });
    const parsed = await provider.parseWebhook({ "stripe-signature": signatureHeader }, rawBody);
    expect(parsed.externalId).toBe("evt_ok");
    expect(parsed.eventType).toBe("checkout.session.completed");
  });
});
