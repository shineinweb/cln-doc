/**
 * DEVELOPMENT PLACEHOLDER DATA for admin CRM views.
 * Replace with `/api/v1/admin/*` responses when CRM modules ship.
 */

export const PLACEHOLDER_NOTICE =
  "Development placeholder content — not loaded from the Admin API.";

export const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/leads", label: "Leads" },
  { to: "/admin/opportunities", label: "Opportunities" },
  { to: "/admin/quotes", label: "Quotes" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/tickets", label: "Tickets" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/prices", label: "Prices" },
  { to: "/admin/invoices", label: "Invoices" },
  { to: "/admin/subscriptions", label: "Subscriptions" },
  { to: "/admin/payments", label: "Payments" },
  { to: "/admin/refunds", label: "Refunds" },
  { to: "/admin/webhooks", label: "Webhooks" },
] as const;

export const PLACEHOLDER_PRODUCTS = [
  {
    id: "prod_ui_ux",
    key: "ui-ux-design",
    name: "UI/UX Design",
    type: "ONE_TIME",
    priceLabel: "$2,500",
  },
  {
    id: "prod_development",
    key: "development",
    name: "Development",
    type: "ONE_TIME",
    priceLabel: "$6,000",
  },
  {
    id: "prod_seo",
    key: "seo-setup",
    name: "SEO Setup",
    type: "ONE_TIME",
    priceLabel: "$1,000",
  },
  {
    id: "prod_hosting",
    key: "hosting",
    name: "Hosting",
    type: "RECURRING",
    priceLabel: "$49/mo",
  },
  {
    id: "prod_maintenance",
    key: "maintenance",
    name: "Maintenance",
    type: "RECURRING",
    priceLabel: "$199/mo",
  },
] as const;

export const PLACEHOLDER_PRICES = [
  {
    id: "price_ui_ux",
    key: "ui-ux-design-once",
    product: "UI/UX Design",
    unitCents: 250_000,
    interval: "ONE_TIME",
  },
  {
    id: "price_dev",
    key: "development-once",
    product: "Development",
    unitCents: 600_000,
    interval: "ONE_TIME",
  },
  {
    id: "price_seo",
    key: "seo-setup-once",
    product: "SEO Setup",
    unitCents: 100_000,
    interval: "ONE_TIME",
  },
  {
    id: "price_hosting",
    key: "hosting-monthly",
    product: "Hosting",
    unitCents: 4_900,
    interval: "MONTHLY",
  },
  {
    id: "price_maintenance",
    key: "maintenance-monthly",
    product: "Maintenance",
    unitCents: 19_900,
    interval: "MONTHLY",
  },
] as const;

export const PLACEHOLDER_INVOICES = [
  {
    id: "inv_dev_001",
    number: "INV-2026-001",
    organization: "Atelier Goods",
    status: "PAID",
    totalCents: 950_000,
    amountPaidCents: 950_000,
  },
  {
    id: "inv_dev_002",
    number: "INV-2026-002",
    organization: "Harbor Clinics",
    status: "SENT",
    totalCents: 2_400_000,
    amountPaidCents: 0,
  },
] as const;

export const PLACEHOLDER_SUBSCRIPTIONS = [
  {
    id: "sub_dev_001",
    name: "Hosting + Maintenance",
    organization: "Atelier Goods",
    status: "ACTIVE",
    amountCents: 24_800,
    interval: "MONTHLY",
  },
  {
    id: "sub_dev_002",
    name: "SEO retainer",
    organization: "Signal Media",
    status: "TRIALING",
    amountCents: 99_000,
    interval: "MONTHLY",
  },
] as const;

export const PLACEHOLDER_PAYMENTS = [
  {
    id: "pay_dev_001",
    invoiceNumber: "INV-2026-001",
    organization: "Atelier Goods",
    status: "SUCCEEDED",
    amountCents: 950_000,
    provider: "stripe",
  },
  {
    id: "pay_dev_002",
    invoiceNumber: "INV-2026-002",
    organization: "Harbor Clinics",
    status: "PENDING",
    amountCents: 2_400_000,
    provider: "stripe",
  },
] as const;

export const PLACEHOLDER_REFUNDS = [
  {
    id: "ref_dev_001",
    paymentId: "pay_dev_001",
    organization: "Atelier Goods",
    status: "PENDING_APPROVAL",
    amountCents: 50_000,
    reason: "Partial scope credit (placeholder)",
  },
] as const;

export const PLACEHOLDER_WEBHOOKS = [
  {
    id: "wh_dev_001",
    provider: "stripe",
    eventType: "invoice.paid",
    status: "PROCESSED",
    externalId: "evt_dev_placeholder_001",
    receivedAt: "2026-03-20T10:00:00Z",
  },
  {
    id: "wh_dev_002",
    provider: "stripe",
    eventType: "charge.refunded",
    status: "RECEIVED",
    externalId: "evt_dev_placeholder_002",
    receivedAt: "2026-03-21T08:15:00Z",
  },
] as const;

export const PLACEHOLDER_LEADS = [
  {
    id: "lead_dev_001",
    contactName: "Jordan Lee",
    companyName: "Northline Retail",
    email: "jordan@northline.example",
    status: "NEW",
    source: "Website quote",
    createdAt: "2026-03-18",
  },
  {
    id: "lead_dev_002",
    contactName: "Samir Patel",
    companyName: "Harbor Clinics",
    email: "samir@harbor.example",
    status: "CONTACTED",
    source: "Referral",
    createdAt: "2026-03-15",
  },
  {
    id: "lead_dev_003",
    contactName: "Riley Chen",
    companyName: "Atelier Goods",
    email: "riley@atelier.example",
    status: "QUALIFIED",
    source: "Inbound call",
    createdAt: "2026-03-10",
  },
] as const;

export const PLACEHOLDER_OPPORTUNITIES = [
  {
    id: "opp_dev_001",
    name: "Harbor — AI support desk",
    stage: "PROPOSAL",
    amountCents: 2400000,
    currency: "USD",
    owner: "Alex Rivera",
    expectedClose: "2026-04-30",
  },
  {
    id: "opp_dev_002",
    name: "Northline — headless rebuild",
    stage: "NEGOTIATION",
    amountCents: 4800000,
    currency: "USD",
    owner: "Alex Rivera",
    expectedClose: "2026-05-15",
  },
  {
    id: "opp_dev_003",
    name: "Atelier — brand + web system",
    stage: "QUALIFICATION",
    amountCents: 1600000,
    currency: "USD",
    owner: "Morgan Blake",
    expectedClose: "2026-04-10",
  },
] as const;

export const PLACEHOLDER_QUOTES = [
  {
    id: "quote_dev_000",
    number: "Q-2026-015",
    title: "Website Development",
    status: "SENT",
    totalCents: 950_000,
    monthlyCents: 24_800,
    currency: "USD",
    organization: "Sample prospect",
    validUntil: "2026-04-30",
    lines: [
      "UI/UX Design — $2,500",
      "Development — $6,000",
      "SEO Setup — $1,000",
      "Hosting — $49/mo",
      "Maintenance — $199/mo",
    ],
  },
  {
    id: "quote_dev_001",
    number: "Q-2026-014",
    title: "Harbor AI Assist — Phase 1",
    status: "SENT",
    totalCents: 2400000,
    monthlyCents: null,
    currency: "USD",
    organization: "Harbor Clinics",
    validUntil: "2026-04-12",
    lines: [] as string[],
  },
  {
    id: "quote_dev_002",
    number: "Q-2026-011",
    title: "Northline Commerce Rebuild",
    status: "DRAFT",
    totalCents: 4800000,
    monthlyCents: null,
    currency: "USD",
    organization: "Northline Retail",
    validUntil: "2026-04-20",
    lines: [] as string[],
  },
  {
    id: "quote_dev_003",
    number: "Q-2026-008",
    title: "Atelier Brand System",
    status: "ACCEPTED",
    totalCents: 1850000,
    monthlyCents: null,
    currency: "USD",
    organization: "Atelier Goods",
    validUntil: "2026-03-01",
    lines: [] as string[],
  },
] as const;

export const PLACEHOLDER_TICKETS = [
  {
    id: "tkt_1001",
    number: 1001,
    subject: "SSL certificate renewal failed",
    customer: "Atelier Goods",
    status: "IN_PROGRESS",
    priority: "HIGH",
    assignee: "Jordan Lee",
    updatedAt: "2026-09-26",
  },
  {
    id: "tkt_1002",
    number: 1002,
    subject: "DNS change for www.example.com",
    customer: "Signal Media",
    status: "WAITING_ON_CUSTOMER",
    priority: "MEDIUM",
    assignee: "Alex Rivera",
    updatedAt: "2026-09-25",
  },
  {
    id: "tkt_1003",
    number: 1003,
    subject: "Invoice copy request",
    customer: "Lumen Labs",
    status: "OPEN",
    priority: "LOW",
    assignee: "—",
    updatedAt: "2026-09-27",
  },
] as const;

export const PLACEHOLDER_CUSTOMERS = [
  {
    id: "cust_dev_001",
    displayName: "Atelier Goods",
    status: "active",
    primaryContact: "Riley Chen",
    email: "riley@atelier.example",
    projects: 1,
    recurring: "Managed hosting",
  },
  {
    id: "cust_dev_002",
    displayName: "Signal Media",
    status: "active",
    primaryContact: "Casey Brooks",
    email: "casey@signal.example",
    projects: 2,
    recurring: "SEO retainer",
  },
  {
    id: "cust_dev_003",
    displayName: "Lumen Labs",
    status: "paused",
    primaryContact: "Drew Ortiz",
    email: "drew@lumen.example",
    projects: 0,
    recurring: "—",
  },
] as const;

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
