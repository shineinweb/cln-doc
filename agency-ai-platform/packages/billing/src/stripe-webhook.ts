/**
 * Stripe webhook signature verification (HMAC SHA-256).
 * Invalid or missing signatures must be rejected before any side effects.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export class StripeWebhookSignatureError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_STRIPE_SIGNATURE") {
    super(message);
    this.name = "StripeWebhookSignatureError";
    this.code = code;
  }
}

export type VerifyStripeWebhookOptions = {
  /** Stripe-Signature header value. */
  signatureHeader: string | undefined;
  rawBody: string;
  webhookSecret: string;
  /** Max age of the Stripe timestamp (default 5 minutes). */
  toleranceSeconds?: number;
  /** Injected clock for tests. */
  nowSeconds?: number;
};

function parseStripeSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  const parts = header.split(",").map((part) => part.trim());
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) {
      timestamp = Number(value);
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestamp || !Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeWebhookSignatureError("Malformed Stripe-Signature header");
  }

  return { timestamp, signatures };
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    if (left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

/**
 * Verify Stripe webhook HMAC. Throws StripeWebhookSignatureError on failure.
 */
export function verifyStripeWebhookSignature(options: VerifyStripeWebhookOptions): {
  timestamp: number;
} {
  const { signatureHeader, rawBody, webhookSecret } = options;
  if (!webhookSecret) {
    throw new StripeWebhookSignatureError("Stripe webhook secret is not configured");
  }
  if (!signatureHeader) {
    throw new StripeWebhookSignatureError("Missing Stripe-Signature header");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new StripeWebhookSignatureError("Stripe webhook timestamp outside tolerance", "STALE");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");

  const matched = signatures.some((signature) => safeEqualHex(signature, expected));
  if (!matched) {
    throw new StripeWebhookSignatureError("Stripe webhook signature mismatch");
  }

  return { timestamp };
}

/** Build a valid Stripe-Signature header for tests. */
export function signStripeWebhookPayload(input: {
  rawBody: string;
  webhookSecret: string;
  timestamp: number;
}): string {
  const digest = createHmac("sha256", input.webhookSecret)
    .update(`${input.timestamp}.${input.rawBody}`, "utf8")
    .digest("hex");
  return `t=${input.timestamp},v1=${digest}`;
}
