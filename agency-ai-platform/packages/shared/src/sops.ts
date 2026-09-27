/**
 * Canonical Standard Operating Procedures (SOP-001 … SOP-030).
 * Staff runbooks — also ground Knowledge / AI agent retrieval.
 */

export const SOP_CATEGORIES = [
  "delivery",
  "domains",
  "hosting",
  "support",
  "billing",
  "security",
  "ai",
] as const;

export type SopCategory = (typeof SOP_CATEGORIES)[number];

export type SopDefinition = {
  code: string;
  number: number;
  title: string;
  category: SopCategory;
  description: string;
};

export const SOP_CATEGORY_LABELS: Record<SopCategory, string> = {
  delivery: "Delivery & projects",
  domains: "Domains & DNS",
  hosting: "Hosting & infrastructure",
  support: "Support & incidents",
  billing: "Billing",
  security: "Security & access",
  ai: "AI operations",
};

export const AGENCY_SOPS: readonly SopDefinition[] = [
  // Delivery
  {
    code: "SOP-001",
    number: 1,
    title: "Lead Intake",
    category: "delivery",
    description: "Capture and triage inbound leads into the CRM pipeline.",
  },
  {
    code: "SOP-002",
    number: 2,
    title: "Customer Onboarding",
    category: "delivery",
    description: "Kick off a new customer after quote acceptance.",
  },
  {
    code: "SOP-003",
    number: 3,
    title: "Website Proposal",
    category: "delivery",
    description: "Scope and price a website proposal / quote package.",
  },
  {
    code: "SOP-004",
    number: 4,
    title: "Website Development",
    category: "delivery",
    description: "Build and iterate website deliverables through project stages.",
  },
  {
    code: "SOP-005",
    number: 5,
    title: "Graphic Design",
    category: "delivery",
    description: "Produce brand and design assets for client approval.",
  },
  {
    code: "SOP-006",
    number: 6,
    title: "Customer Approval",
    category: "delivery",
    description: "Collect customer sign-off on deliverables and revisions.",
  },
  {
    code: "SOP-007",
    number: 7,
    title: "Website QA",
    category: "delivery",
    description: "Quality-check websites before launch (functional + visual).",
  },
  {
    code: "SOP-008",
    number: 8,
    title: "Website Launch",
    category: "delivery",
    description: "Go-live checklist: DNS, SSL, content, monitoring handoff.",
  },
  // Domains
  {
    code: "SOP-009",
    number: 9,
    title: "Domain Registration",
    category: "domains",
    description: "Register domains via DomainProvider for a customer.",
  },
  {
    code: "SOP-010",
    number: 10,
    title: "Domain Transfer",
    category: "domains",
    description: "Inbound/outbound domain transfers with auth codes and locks.",
  },
  {
    code: "SOP-011",
    number: 11,
    title: "DNS Changes",
    category: "domains",
    description: "Apply and verify DNS record changes (approval for deletes).",
  },
  // Hosting
  {
    code: "SOP-012",
    number: 12,
    title: "Hosting Provisioning",
    category: "hosting",
    description: "Provision hosting accounts via HostingProvider / WHM.",
  },
  {
    code: "SOP-013",
    number: 13,
    title: "Website Migration",
    category: "hosting",
    description: "Migrate sites between hosts with cutover verification.",
  },
  {
    code: "SOP-014",
    number: 14,
    title: "SSL",
    category: "hosting",
    description: "Issue, renew, and troubleshoot SSL certificates.",
  },
  {
    code: "SOP-015",
    number: 15,
    title: "Backups",
    category: "hosting",
    description: "Schedule, verify, and restore hosting backups.",
  },
  {
    code: "SOP-016",
    number: 16,
    title: "Hosting Suspension",
    category: "hosting",
    description: "Suspend/unsuspend accounts with approval and customer notice.",
  },
  // Support
  {
    code: "SOP-017",
    number: 17,
    title: "Support Ticket Handling",
    category: "support",
    description: "Triage, assign, and resolve tickets through status pipeline.",
  },
  {
    code: "SOP-018",
    number: 18,
    title: "Critical Incident",
    category: "support",
    description: "Escalate and communicate critical customer-impacting incidents.",
  },
  {
    code: "SOP-019",
    number: 19,
    title: "Server Outage",
    category: "support",
    description: "Diagnose and restore service during host/server outages.",
  },
  // Billing
  {
    code: "SOP-020",
    number: 20,
    title: "Billing",
    category: "billing",
    description: "Invoice, collect, and reconcile customer billing events.",
  },
  {
    code: "SOP-021",
    number: 21,
    title: "Refund",
    category: "billing",
    description: "Process refunds via PaymentProvider with approval gates.",
  },
  {
    code: "SOP-022",
    number: 22,
    title: "Cancellation",
    category: "billing",
    description: "Cancel services, stop renewals, and close access cleanly.",
  },
  // Security
  {
    code: "SOP-023",
    number: 23,
    title: "Employee Access",
    category: "security",
    description: "Provision and revoke staff RBAC access and offboarding.",
  },
  {
    code: "SOP-024",
    number: 24,
    title: "Password Security",
    category: "security",
    description: "Password policy, rotation, and credential hygiene.",
  },
  {
    code: "SOP-025",
    number: 25,
    title: "API Credentials",
    category: "security",
    description: "Issue, store, and rotate API keys and provider secrets.",
  },
  {
    code: "SOP-026",
    number: 26,
    title: "Data Breach",
    category: "security",
    description: "Contain, investigate, and notify on suspected data breaches.",
  },
  // AI
  {
    code: "SOP-027",
    number: 27,
    title: "AI Customer Support",
    category: "ai",
    description: "Run Support AI with customer-scoped tools and RAG.",
  },
  {
    code: "SOP-028",
    number: 28,
    title: "AI Tool Approval",
    category: "ai",
    description: "AI requests approval → Admin approves → Tool executes → Audit log.",
  },
  {
    code: "SOP-029",
    number: 29,
    title: "AI Knowledge Training",
    category: "ai",
    description: "Resolved answers → Knowledge Proposal → human approve → embed/index.",
  },
  {
    code: "SOP-030",
    number: 30,
    title: "AI Incident Response",
    category: "ai",
    description: "Respond to AI failures, policy denials, and forbidden-path attempts.",
  },
] as const;

export function isSopCategory(value: string): value is SopCategory {
  return (SOP_CATEGORIES as readonly string[]).includes(value);
}

export function getSopByCode(code: string): SopDefinition | undefined {
  return AGENCY_SOPS.find((sop) => sop.code === code);
}

export function listSopsByCategory(category: SopCategory): readonly SopDefinition[] {
  return AGENCY_SOPS.filter((sop) => sop.category === category);
}

export function formatSopLabel(sop: SopDefinition): string {
  return `${sop.code} ${sop.title}`;
}
