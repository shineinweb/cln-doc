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
  { to: "/admin/knowledge", label: "Knowledge" },
  { to: "/admin/ai", label: "AI" },
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

export const PLACEHOLDER_KNOWLEDGE_ARTICLES = [
  {
    id: "ka_ssl",
    slug: "enable-ssl-on-hosting",
    title: "Enable SSL on your hosting plan",
    category: "Hosting",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    updatedAt: "2026-09-20",
  },
  {
    id: "ka_dns",
    slug: "point-domain-to-hosting",
    title: "Point a domain to your hosting",
    category: "Domains",
    status: "PUBLISHED",
    visibility: "BOTH",
    updatedAt: "2026-09-18",
  },
  {
    id: "ka_refund",
    slug: "request-a-refund",
    title: "Request a refund",
    category: "Billing",
    status: "DRAFT",
    visibility: "INTERNAL",
    updatedAt: "2026-09-27",
  },
] as const;

export const PLACEHOLDER_TICKETS = [
  {
    id: "tkt_1001",
    number: 1001,
    subject: "SSL certificate renewal failed",
    customer: "Atelier Goods",
    status: "ESCALATED",
    priority: "HIGH",
    assignee: "Jordan Lee",
    updatedAt: "2026-09-26",
  },
  {
    id: "tkt_1002",
    number: 1002,
    subject: "DNS change for www.example.com",
    customer: "Signal Media",
    status: "CUSTOMER_REPLY",
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
  {
    id: "tkt_1004",
    number: 1004,
    subject: "Staging site access request",
    customer: "Atelier Goods",
    status: "PENDING",
    priority: "MEDIUM",
    assignee: "Alex Rivera",
    updatedAt: "2026-09-27",
  },
] as const;

export const PLACEHOLDER_AI_APPROVALS = [
  {
    id: "apr_ui_001",
    toolName: "createPullRequests",
    agent: "Coding",
    risk: "write",
    status: "pending",
    requestedAt: "2026-09-27 14:02",
  },
  {
    id: "apr_ui_002",
    toolName: "approveKnowledgeProposal",
    agent: "Knowledge",
    risk: "write",
    status: "pending",
    requestedAt: "2026-09-27 13:40",
  },
  {
    id: "apr_ui_003",
    toolName: "createBranches",
    agent: "Coding",
    risk: "write",
    status: "approved",
    requestedAt: "2026-09-26 18:11",
  },
] as const;

export const PLACEHOLDER_AI_RUNS = [
  {
    id: "run_host_881",
    agent: "Hosting",
    status: "completed",
    summary: "SSL + DNS checks for atelier.example — diagnosis ready",
  },
  {
    id: "run_sup_772",
    agent: "Customer Support",
    status: "completed",
    summary: "Answered invoice question; knowledge proposal drafted",
  },
  {
    id: "run_code_661",
    agent: "Coding",
    status: "awaiting_approval",
    summary: "Draft PR for hosting card fix — waiting on admin",
  },
] as const;

export const PLACEHOLDER_AI_CONVERSATIONS = [
  {
    id: "conv_901",
    agent: "Customer Support",
    user: "riley@atelier.example",
    messages: 6,
    updatedAt: "2026-09-27 12:10",
  },
  {
    id: "conv_902",
    agent: "Hosting",
    user: "casey@signal.example",
    messages: 4,
    updatedAt: "2026-09-27 11:02",
  },
] as const;

export const PLACEHOLDER_AI_TOOL_CALLS = [
  {
    id: "tc_501",
    toolName: "checkSsl",
    agent: "Hosting",
    risk: "read",
    status: "ok",
    latencyMs: "180ms",
  },
  {
    id: "tc_502",
    toolName: "createKnowledgeProposal",
    agent: "Knowledge",
    risk: "write",
    status: "ok",
    latencyMs: "95ms",
  },
  {
    id: "tc_503",
    toolName: "createPullRequests",
    agent: "Coding",
    risk: "write",
    status: "awaiting_approval",
    latencyMs: "—",
  },
] as const;

export const PLACEHOLDER_AI_COSTS = [
  { period: "2026-09", agent: "Customer Support", model: "gpt-4o-mini", costUsd: "$42.10" },
  { period: "2026-09", agent: "Hosting", model: "gpt-4o-mini", costUsd: "$18.40" },
  { period: "2026-09", agent: "Coding", model: "gpt-4o", costUsd: "$96.25" },
] as const;

export const PLACEHOLDER_AI_TOKEN_USAGE = [
  {
    period: "2026-09-27",
    promptTokens: 128_400,
    completionTokens: 41_200,
    totalTokens: 169_600,
    budgetUsed: "34%",
  },
  {
    period: "2026-09",
    promptTokens: 2_410_000,
    completionTokens: 780_000,
    totalTokens: 3_190_000,
    budgetUsed: "61%",
  },
] as const;

export const PLACEHOLDER_AI_KNOWLEDGE_JOBS = [
  {
    id: "idx_301",
    source: "article:enable-ssl-on-hosting",
    status: "ready",
    chunks: 12,
    updatedAt: "2026-09-27 09:00",
  },
  {
    id: "idx_302",
    source: "proposal:apr_ui_002",
    status: "pending_review",
    chunks: 0,
    updatedAt: "2026-09-27 13:40",
  },
] as const;

export const PLACEHOLDER_AI_FEEDBACK = [
  {
    id: "fb_201",
    runId: "run_sup_772",
    rating: "up",
    comment: "Clear invoice explanation",
    at: "2026-09-27 12:15",
  },
  {
    id: "fb_202",
    runId: "run_host_881",
    rating: "down",
    comment: "Missed custom nameserver note",
    at: "2026-09-27 11:20",
  },
] as const;

export const PLACEHOLDER_AI_EVALUATIONS = [
  {
    suite: "support_kb_v1",
    score: "0.82",
    passed: 41,
    failed: 9,
    ranAt: "2026-09-26",
  },
  {
    suite: "hosting_diag_v1",
    score: "0.91",
    passed: 22,
    failed: 2,
    ranAt: "2026-09-25",
  },
] as const;

export const PLACEHOLDER_AI_FAILURES = [
  {
    id: "fail_101",
    agent: "Coding",
    error: "OpenAI transport unwired (503 PLACEHOLDER)",
    at: "2026-09-27 10:01",
  },
  {
    id: "fail_102",
    agent: "Hosting",
    error: "HostingProvider.getUsage unwired",
    at: "2026-09-26 22:14",
  },
] as const;

export const PLACEHOLDER_AI_SECURITY_EVENTS = [
  {
    id: "sec_001",
    kind: "forbidden_path",
    detail: "Blocked AI → production server → randomly change files",
    at: "2026-09-27 08:44",
  },
  {
    id: "sec_002",
    kind: "kill_switch",
    detail: "ai.enabled=false refused completion for org_demo",
    at: "2026-09-20 16:00",
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
