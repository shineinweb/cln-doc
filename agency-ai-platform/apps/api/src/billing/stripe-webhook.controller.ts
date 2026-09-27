import {
  BadRequestException,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { StripeWebhookSignatureError, type PaymentProvider } from "@agency/billing";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { PAYMENT_PROVIDER } from "./billing.constants";

/**
 * Stripe webhooks are public (no session) but signature-verified.
 * Invalid signatures are rejected before any domain side effects.
 */
@Controller("webhooks")
export class StripeWebhookController {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider) {}

  @Public()
  @Post("stripe")
  async handleStripe(
    @Req() request: Request & { rawBody?: Buffer | string },
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const rawBody = resolveRawBody(request);
    try {
      const event = await this.paymentProvider.parseWebhook(headers, rawBody);
      // PLACEHOLDER: persist WebhookEvent + enqueue — verification is the production gate.
      return { data: { received: true, externalId: event.externalId, eventType: event.eventType } };
    } catch (error) {
      if (error instanceof StripeWebhookSignatureError) {
        throw new UnauthorizedException({
          title: "Invalid Stripe webhook",
          detail: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  }
}

function resolveRawBody(request: Request & { rawBody?: Buffer | string }): string {
  if (typeof request.rawBody === "string") {
    return request.rawBody;
  }
  if (Buffer.isBuffer(request.rawBody)) {
    return request.rawBody.toString("utf8");
  }
  if (typeof request.body === "string") {
    return request.body;
  }
  if (request.body && typeof request.body === "object") {
    // Fallback for unit tests that pass a parsed object — production must use raw bytes.
    return JSON.stringify(request.body);
  }
  throw new BadRequestException("Missing Stripe webhook raw body");
}
