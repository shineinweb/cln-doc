/**
 * Canonical Agency AI Platform build sequence (01 → 30).
 *
 * Architecture → … → Security Audit → Staging → Production
 *
 * Status reflects scaffold readiness (schema / docs / shells vs full APIs).
 */

export const BUILD_SEQUENCE_STATUSES = ["complete", "in_progress", "planned"] as const;

export type BuildSequenceStatus = (typeof BUILD_SEQUENCE_STATUSES)[number];

export type BuildSequenceStepDefinition = {
  /** 1–30 */
  number: number;
  /** Zero-padded code, e.g. "01" */
  code: string;
  key: string;
  label: string;
  description: string;
  status: BuildSequenceStatus;
};

export const BUILD_SEQUENCE_DIAGRAM = `
01 Architecture
        ↓
02 Cursor Rules
        ↓
03 Monorepo
        ↓
04 MariaDB + Redis
        ↓
05 Prisma
        ↓
06 Authentication
        ↓
07 Roles & Permissions
        ↓
08 Public React/Vite Website
        ↓
09 CRM
        ↓
10 Projects
        ↓
11 Quotes/Contracts
        ↓
12 Billing
        ↓
13 Customer Portal
        ↓
14 Hosting
        ↓
15 Domains/DNS
        ↓
16 Support Tickets
        ↓
17 Knowledge Base
        ↓
18 AI Foundation
        ↓
19 AI Supervisor
        ↓
20 Customer Support AI
        ↓
21 Coding AI
        ↓
22 Hosting AI
        ↓
23 Sales/SEO AI
        ↓
24 AI Learning System
        ↓
25 AI Control Center
        ↓
26 Reports/Analytics
        ↓
27 Testing
        ↓
28 Security Audit
        ↓
29 Staging
        ↓
30 Production
`.trim();

export const BUILD_SEQUENCE: readonly BuildSequenceStepDefinition[] = [
  {
    number: 1,
    code: "01",
    key: "architecture",
    label: "Architecture",
    description: "System contracts under docs/ (apps, packages, providers, tenancy).",
    status: "complete",
  },
  {
    number: 2,
    code: "02",
    key: "cursor_rules",
    label: "Cursor Rules",
    description: "Agent/contributor rules in AGENTS.md, DEVELOPMENT_RULES.md, .cursor/rules.",
    status: "complete",
  },
  {
    number: 3,
    code: "03",
    key: "monorepo",
    label: "Monorepo",
    description: "pnpm workspaces: apps/* + packages/* tooling.",
    status: "complete",
  },
  {
    number: 4,
    code: "04",
    key: "mariadb_redis",
    label: "MariaDB + Redis",
    description: "Docker Compose local MariaDB and Redis with healthchecks.",
    status: "complete",
  },
  {
    number: 5,
    code: "05",
    key: "prisma",
    label: "Prisma",
    description: "MariaDB Prisma schema, migrations, and @agency/database client.",
    status: "complete",
  },
  {
    number: 6,
    code: "06",
    key: "authentication",
    label: "Authentication",
    description: "Register/login/sessions/password reset; MFA still pending.",
    status: "complete",
  },
  {
    number: 7,
    code: "07",
    key: "roles_permissions",
    label: "Roles & Permissions",
    description: "PLATFORM_ROLES catalog, PermissionsGuard, StaffGuard, tenant helpers.",
    status: "complete",
  },
  {
    number: 8,
    code: "08",
    key: "public_website",
    label: "Public React/Vite Website",
    description: "Marketing/site shell (services, pricing, portfolio, KB entry, contact).",
    status: "complete",
  },
  {
    number: 9,
    code: "09",
    key: "crm",
    label: "CRM",
    description: "Lead/Opportunity schema + admin shells; CRM APIs still pending.",
    status: "in_progress",
  },
  {
    number: 10,
    code: "10",
    key: "projects",
    label: "Projects",
    description: "Project delivery hierarchy + status pipeline; full APIs pending.",
    status: "in_progress",
  },
  {
    number: 11,
    code: "11",
    key: "quotes_contracts",
    label: "Quotes/Contracts",
    description: "Quote lifecycle constants + schema; send/accept APIs pending.",
    status: "in_progress",
  },
  {
    number: 12,
    code: "12",
    key: "billing",
    label: "Billing",
    description: "PaymentProvider, refund authz, Stripe webhook verify; live Stripe pending.",
    status: "in_progress",
  },
  {
    number: 13,
    code: "13",
    key: "customer_portal",
    label: "Customer Portal",
    description: "Portal shell, welcome dashboard, tickets/hosting/Ask AI entry points.",
    status: "in_progress",
  },
  {
    number: 14,
    code: "14",
    key: "hosting",
    label: "Hosting",
    description: "HostingProvider + portal hosting cards; WHM live transport PLACEHOLDER.",
    status: "in_progress",
  },
  {
    number: 15,
    code: "15",
    key: "domains_dns",
    label: "Domains/DNS",
    description: "DomainProvider / DnsProvider interfaces; registrar adapter PLACEHOLDER.",
    status: "in_progress",
  },
  {
    number: 16,
    code: "16",
    key: "support_tickets",
    label: "Support Tickets",
    description: "Support schema + portal ticket UI shells; ticket APIs pending.",
    status: "in_progress",
  },
  {
    number: 17,
    code: "17",
    key: "knowledge_base",
    label: "Knowledge Base",
    description: "KB schema + capture pipeline; CMS publish UX pending.",
    status: "in_progress",
  },
  {
    number: 18,
    code: "18",
    key: "ai_foundation",
    label: "AI Foundation",
    description: "AiService, LLM/Embedding/VectorStore providers; OpenAI transport PLACEHOLDER.",
    status: "in_progress",
  },
  {
    number: 19,
    code: "19",
    key: "ai_supervisor",
    label: "AI Supervisor",
    description: "Supervisor org chart and specialist roster in @agency/ai.",
    status: "in_progress",
  },
  {
    number: 20,
    code: "20",
    key: "customer_support_ai",
    label: "Customer Support AI",
    description: "Support agent tools registered; domain handlers PLACEHOLDER.",
    status: "in_progress",
  },
  {
    number: 21,
    code: "21",
    key: "coding_ai",
    label: "Coding AI",
    description: "Coding tools + AI Code→…→Deploy pipeline; no autonomous production deploys.",
    status: "in_progress",
  },
  {
    number: 22,
    code: "22",
    key: "hosting_ai",
    label: "Hosting AI",
    description: "Hosting diagnostic pipeline + tools; approval for renew/suspend paths.",
    status: "in_progress",
  },
  {
    number: 23,
    code: "23",
    key: "sales_seo_ai",
    label: "Sales/SEO AI",
    description: "Roster entries planned; specialist tools and APIs not fully built.",
    status: "planned",
  },
  {
    number: 24,
    code: "24",
    key: "ai_learning_system",
    label: "AI Learning System",
    description: "Knowledge capture pipeline, memory/eval stubs; feedback loops pending.",
    status: "in_progress",
  },
  {
    number: 25,
    code: "25",
    key: "ai_control_center",
    label: "AI Control Center",
    description: "Admin /admin/ai sections + execution approval cards (API PLACEHOLDER).",
    status: "in_progress",
  },
  {
    number: 26,
    code: "26",
    key: "reports_analytics",
    label: "Reports/Analytics",
    description: "Admin Today dashboard placeholders; report APIs not built.",
    status: "planned",
  },
  {
    number: 27,
    code: "27",
    key: "testing",
    label: "Testing",
    description: "Vitest unit/integration/API/authz/tenant suites + CI workflow.",
    status: "in_progress",
  },
  {
    number: 28,
    code: "28",
    key: "security_audit",
    label: "Security Audit",
    description: "docs/SECURITY_AUDIT.md completed; High findings remediation pending.",
    status: "complete",
  },
  {
    number: 29,
    code: "29",
    key: "staging",
    label: "Staging",
    description: "Release pipeline + staging job PLACEHOLDER deploy target.",
    status: "in_progress",
  },
  {
    number: 30,
    code: "30",
    key: "production",
    label: "Production",
    description: "Production deploy after manual approval — not live yet.",
    status: "planned",
  },
] as const;

export const BUILD_SEQUENCE_STEP_COUNT = BUILD_SEQUENCE.length;

export function formatBuildStepLabel(step: BuildSequenceStepDefinition): string {
  return `${step.code} ${step.label}`;
}

export function getBuildStepByNumber(number: number): BuildSequenceStepDefinition | undefined {
  return BUILD_SEQUENCE.find((step) => step.number === number);
}

export function getBuildStepByKey(key: string): BuildSequenceStepDefinition | undefined {
  return BUILD_SEQUENCE.find((step) => step.key === key);
}

export function isBuildSequenceStatus(value: string): value is BuildSequenceStatus {
  return (BUILD_SEQUENCE_STATUSES as readonly string[]).includes(value);
}

export function listBuildStepsByStatus(
  status: BuildSequenceStatus,
): readonly BuildSequenceStepDefinition[] {
  return BUILD_SEQUENCE.filter((step) => step.status === status);
}

/** Next step after `number`, or null after 30 Production. */
export function getNextBuildStep(number: number): BuildSequenceStepDefinition | null {
  if (number < 1 || number >= BUILD_SEQUENCE_STEP_COUNT) return null;
  return BUILD_SEQUENCE[number] ?? null;
}
