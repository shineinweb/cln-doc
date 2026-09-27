import { Module } from "@nestjs/common";
import { StripePaymentProvider } from "@agency/billing";
import { StaffGuard } from "../common/guards/staff.guard";
import { PAYMENT_PROVIDER } from "./billing.constants";
import { RefundsController } from "./refunds.controller";
import { RefundsService } from "./refunds.service";
import { StripeWebhookController } from "./stripe-webhook.controller";

@Module({
  controllers: [RefundsController, StripeWebhookController],
  providers: [
    StaffGuard,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: () =>
        new StripePaymentProvider({
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || "whsec_unwired",
          secretKey: process.env.STRIPE_SECRET_KEY?.trim(),
        }),
    },
    RefundsService,
  ],
  exports: [PAYMENT_PROVIDER],
})
export class BillingModule {}
