import { describe, expect, it } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { signStripeWebhookPayload, StripePaymentProvider } from "@agency/billing";
import { StripeWebhookController } from "./stripe-webhook.controller";

const SECRET = "whsec_api_test";

describe("Stripe webhook API", () => {
  it("rejects invalid Stripe webhooks", async () => {
    const provider = new StripePaymentProvider({ webhookSecret: SECRET });
    const controller = new StripeWebhookController(provider);
    const rawBody = JSON.stringify({ id: "evt_bad", type: "invoice.paid" });

    await expect(
      controller.handleStripe({ rawBody, body: JSON.parse(rawBody) } as never, {
        "stripe-signature": "t=1,v1=invalid",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts signed Stripe webhooks", async () => {
    const provider = new StripePaymentProvider({ webhookSecret: SECRET });
    const controller = new StripeWebhookController(provider);
    const rawBody = JSON.stringify({ id: "evt_ok", type: "invoice.paid" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signStripeWebhookPayload({
      rawBody,
      webhookSecret: SECRET,
      timestamp,
    });

    const result = await controller.handleStripe({ rawBody, body: JSON.parse(rawBody) } as never, {
      "stripe-signature": signature,
    });
    expect(result.data.received).toBe(true);
    expect(result.data.externalId).toBe("evt_ok");
  });
});
