import type { SubscriptionStatus } from '@instagram-ai/shared'
import type { Env } from '../env'
import { ApiError } from '../errors'
import { verifyStripeSignature } from '../crypto'

export type CheckoutInput = {
  organizationId: string
  packageId: string
  packageName: string
  priceMinor: number
  currency: string
  successUrl: string
  cancelUrl: string
  customerEmail: string
}

export type BillingUpdate = {
  externalId: string
  organizationId?: string
  providerSubscriptionId?: string
  providerCustomerId?: string
  packageId?: string
  status?: SubscriptionStatus
}

export interface PaymentProvider {
  createCheckout(input: CheckoutInput): Promise<{ url: string }>
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>
  handleWebhook(raw: Buffer, signature: string | undefined): BillingUpdate | null
}

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'canceled',
  paused: 'past_due',
}

export function parseStripeEvent(event: {
  id?: string
  type?: string
  data?: { object?: Record<string, unknown> }
}): BillingUpdate | null {
  const object = event.data?.object ?? {}
  const metadata = (object.metadata ?? {}) as Record<string, string>
  const externalId = event.id || ''
  if (!externalId) return null
  if (event.type === 'checkout.session.completed') {
    return {
      externalId,
      organizationId: metadata.organizationId,
      packageId: metadata.packageId,
      providerCustomerId: typeof object.customer === 'string' ? object.customer : undefined,
      providerSubscriptionId: typeof object.subscription === 'string' ? object.subscription : undefined,
      status: 'active',
    }
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const stripeStatus = String(object.status ?? '')
    return {
      externalId,
      organizationId: metadata.organizationId,
      packageId: metadata.packageId,
      providerCustomerId: typeof object.customer === 'string' ? object.customer : undefined,
      providerSubscriptionId: typeof object.id === 'string' ? object.id : undefined,
      status: event.type === 'customer.subscription.deleted' ? 'canceled' : STATUS_MAP[stripeStatus],
    }
  }
  return null
}

export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private env: Env,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async createCheckout(input: CheckoutInput): Promise<{ url: string }> {
    if (!this.env.STRIPE_SECRET_KEY) {
      throw new ApiError(400, 'billing_unconfigured', 'Stripe is not configured. Local development can assign a package without a charge.')
    }
    const body = new URLSearchParams()
    body.set('mode', 'subscription')
    body.set('success_url', input.successUrl)
    body.set('cancel_url', input.cancelUrl)
    body.set('customer_email', input.customerEmail)
    body.set('client_reference_id', input.organizationId)
    body.set('metadata[organizationId]', input.organizationId)
    body.set('metadata[packageId]', input.packageId)
    body.set('line_items[0][quantity]', '1')
    body.set('line_items[0][price_data][currency]', input.currency.toLowerCase())
    body.set('line_items[0][price_data][unit_amount]', String(input.priceMinor))
    body.set('line_items[0][price_data][product_data][name]', input.packageName)
    body.set('line_items[0][price_data][recurring][interval]', 'month')
    body.set('subscription_data[metadata][organizationId]', input.organizationId)
    body.set('subscription_data[metadata][packageId]', input.packageId)
    const response = await this.fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const payload = (await response.json()) as { url?: string; error?: { message?: string } }
    if (!response.ok || !payload.url) throw new ApiError(502, 'billing_failed', payload.error?.message || 'Stripe checkout failed')
    return { url: payload.url }
  }

  async createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    if (!this.env.STRIPE_SECRET_KEY) {
      throw new ApiError(400, 'billing_unconfigured', 'Stripe is not configured. Local development can assign a package without a charge.')
    }
    const body = new URLSearchParams({ customer: input.customerId, return_url: input.returnUrl })
    const response = await this.fetchImpl('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const payload = (await response.json()) as { url?: string; error?: { message?: string } }
    if (!response.ok || !payload.url) throw new ApiError(502, 'billing_failed', payload.error?.message || 'Stripe portal failed')
    return { url: payload.url }
  }

  handleWebhook(raw: Buffer, signature: string | undefined): BillingUpdate | null {
    const payload = raw.toString('utf8')
    if (!verifyStripeSignature(this.env.STRIPE_WEBHOOK_SECRET, payload, signature)) {
      throw new ApiError(400, 'invalid_signature', 'Stripe signature was rejected')
    }
    return parseStripeEvent(JSON.parse(payload) as { id?: string; type?: string; data?: { object?: Record<string, unknown> } })
  }
}

export function createPaymentProvider(env: Env): PaymentProvider {
  return new StripePaymentProvider(env)
}
