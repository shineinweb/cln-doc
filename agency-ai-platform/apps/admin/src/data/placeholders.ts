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
