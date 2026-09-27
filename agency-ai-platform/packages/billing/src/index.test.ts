import { describe, expect, it } from "vitest";
import { getPlan, PLANS, type PaymentProvider } from "./index";

describe("billing plans", () => {
  it("lists catalog plans", () => {
    expect(PLANS.length).toBeGreaterThan(0);
  });

  it("resolves a known plan", () => {
    expect(getPlan("starter")?.monthlyCents).toBe(9900);
  });

  it("exposes PaymentProvider as a structural contract", () => {
    const provider: PaymentProvider = {
      name: "noop",
      createCheckoutSession: async () => ({
        provider: "noop",
        externalId: "cs_test",
        checkoutUrl: "https://example.test/checkout",
      }),
      createRefund: async () => ({
        provider: "noop",
        externalId: "re_test",
        status: "SUCCEEDED",
      }),
      parseWebhook: async () => ({
        eventType: "test.event",
        externalId: "evt_test",
        payload: {},
      }),
    };
    expect(provider.name).toBe("noop");
  });
});
