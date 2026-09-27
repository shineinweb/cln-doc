# Product & Delivery Roadmap

Phased plan to build the Agency AI Platform from architecture → production SaaS.  
**Current phase:** Phase 1 complete for auth + public site shell; commercial lifecycle **schema** landed (Lead → Recurring Services). API modules for CRM/sales still pending.

Companion docs: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

## Guiding principles

1. Ship vertical slices that are usable end-to-end.
2. Keep MariaDB as the only SQL system of record.
3. Introduce providers behind interfaces from day one of each integration.
4. Do not enable high-risk AI tools without approval + audit.
5. Prefer boring, observable infrastructure (Docker, Nginx, Redis, BullMQ).

---

## Phase 0 — Foundations (complete / in progress)

**Outcomes**

- [x] Monorepo scaffold (`apps/*`, `packages/*`, pnpm workspaces)
- [x] Architecture documentation set (this folder)
- [x] Docker Compose local infra (MariaDB + Redis, volumes, healthchecks)
- [ ] Docker Compose app/worker/Nginx services — _later_
- [x] `@agency/database` Prisma MariaDB schema baseline (User/Session/Org/RBAC/Customer/AuditLog)
- [x] Commercial lifecycle schema: Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services (`Subscription`)
- [x] Shared lint/test/CI pipeline for the monorepo (ESLint, Prettier, Vitest, typecheck, build)

**Exit criteria:** developers can run empty API + MariaDB + Redis locally from documented commands.

---

## Phase 1 — Identity, tenancy, public site shell

**Outcomes**

- [x] Auth: register/login/logout/verify-email/reset, sessions, RBAC guards (staff invite still pending)
- Organizations + memberships
- RBAC seed roles/permissions
- Public website pages wired to CMS/catalog stubs (services, pricing, portfolio, blog, KB, contact, quote request)
- Audit log for auth & admin role changes

**Providers:** `EmailProvider` (transactional), `StorageProvider` (optional avatars)

**Exit criteria:** a customer can register, log into an empty portal shell; staff can log into admin shell with RBAC.

---

## Phase 2 — CRM, sales, quotes, contracts

**Canonical path:** Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services

**Outcomes**

- [x] Prisma models for Lead, Opportunity, Quote, Project, Invoice, Subscription (+ line/activity items)
- Leads, activities, conversion → organization / customer
- Opportunities pipeline APIs + admin UI
- Service catalog + hosting plans (content)
- Quotes + line items; send + customer actions (View / Accept / Reject / Request changes)
- Contracts + e-sign (simple) + PDF via storage
- Admin CRM + sales views; portal quote/contract views

**Exit criteria:** lead → opportunity → quote → customer path works end-to-end without billing providers.

---

## Phase 3 — Projects, tasks, files, notifications

**Hierarchy:** Project → Milestone → Task → Subtask (+ Comment, Attachment, TimeEntry, ProjectMember, ProjectActivity)

**Project pipeline:** New → Planning → Design → Development → Customer Review → Revision → QA → Launch → Maintenance

**Outcomes**

- [x] Prisma models for Project delivery hierarchy (Milestone, Task, Subtask, Comment, Attachment, TimeEntry, ProjectMember, ProjectActivity)
- [x] Canonical `ProjectStatus` pipeline (New → Maintenance)
- Projects / tasks APIs + admin / portal views
- File uploads (`StorageProvider`) wired to `Attachment.storageKey`
- Portal project visibility
- In-app notifications + WebSocket fan-out
- Basic admin assignment for developers/designers

**Exit criteria:** staff run a project; customer sees progress and files.

---

## Phase 4 — Billing (Stripe)

**Domain:** Products · Prices · Invoices · Subscriptions · Payments · Refund workflow · Webhooks

**Outcomes**

- [x] Prisma models for Product, Price, Payment, Refund, PaymentMethod, BillingCustomer, WebhookEvent (+ Invoice/Subscription provider refs)
- [x] `PaymentProvider` interface in `@agency/billing` (+ refund workflow constants)
- Stripe adapter implementing `PaymentProvider`
- Invoices, payments, customer portal pay flow
- Subscriptions (hosting/maintenance retainers)
- Webhook inbox processing + idempotency
- Admin billing ops (refunds permissioned)

**Exit criteria:** test-mode Stripe checkout settles an invoice and activates a subscription record.

---

## Phase 5 — Domains & DNS

**Outcomes**

- `DomainProvider` + `DnsProvider` interfaces
- Domain search (public + portal)
- Register/renew/transfer orders (async jobs)
- DNS record CRUD with audit
- Admin override tools

**Exit criteria:** sandbox/test registrar path registers a domain and manages DNS records.

---

## Phase 6 — Hosting (cPanel/WHM)

**Outcomes**

- `HostingProvider` WHM adapter
- Server inventory + hosting accounts
- Provision on subscription / order
- Suspend/unsuspend/terminate with approvals for destructive ops
- Portal hosting dashboard (status, limited actions)
- Sync jobs MariaDB ↔ WHM

**Exit criteria:** create and suspend a cPanel account via provider in a non-prod WHM.

---

## Phase 7 — Support & knowledge base

**Outcomes**

- Tickets + messages + attachments
- SLA fields / assignment
- KB CMS (public + internal)
- Portal + admin ticket UX
- Macro/canned replies

**Exit criteria:** customer opens ticket; staff resolves with KB-linked answer.

---

## Phase 8 — AI platform (v1)

**Outcomes**

- `LLMProvider`, `EmbeddingProvider`, `VectorStore` (MariaDB)
- Supervisor + Support agent (read-only tools + draft replies)
- RAG over published KB
- Portal AI assistant (scoped)
- Admin run viewer + feedback capture
- Approval framework in place (even if few tools gated)

**Exit criteria:** customer asks KB-grounded question; staff see run audit; no high-risk tools auto-execute.

---

## Phase 9 — AI specialists & ops tools

**Outcomes**

- Sales, SEO, Hosting, Coding agents
- Tool calling into CRM/hosting/DNS/billing (gated)
- Human approval queue UX
- Memory + evaluation harness
- Cost quotas and kill switch

**Exit criteria:** hosting/DNS high-risk tool requires approval; eval suite gates agent version publish.

---

## Phase 10 — Reporting, hardening, production launch

**Outcomes**

- Admin reports (sales, delivery, hosting, support, AI cost)
- Performance indexes, read replicas if needed
- Security review, dependency audit, backup/restore drills
- Nginx/TLS production topology
- Runbooks & on-call basics
- Soft launch → GA

**Exit criteria:** production checklist signed off; monitoring green; rollback path tested.

---

## Cross-cutting workstreams (parallel)

| Stream                       | Starts     | Notes                           |
| ---------------------------- | ---------- | ------------------------------- |
| Design system (`@agency/ui`) | Phase 1    | Shared across three apps        |
| Observability                | Phase 1    | Logs, metrics, request ids      |
| CI/CD                        | Phase 0–1  | Lint, typecheck, test, migrate  |
| Provider fakes               | Each phase | Local dev without vendors       |
| Compliance readiness         | Phase 4+   | Erasure jobs, AI data retention |

---

## Explicitly deferred

- Native mobile apps
- Marketplace of third-party plugins
- Customer-hosted LLM runtimes
- Autonomous production code deployment by Coding AI
- PostgreSQL / `pgvector` (permanently out of scope as primary DB)
- Multi-agency white-label SaaS (single agency operator first; schema may later extend)

---

## Suggested near-term engineering order

After these docs are accepted:

1. Docker Compose + MariaDB + Redis + Prisma baseline schema (Identity + RBAC + Audit)
2. Auth + public website information architecture
3. Portal/admin shells with navigation matching product IA
4. Then Phase 2 vertical slice (CRM → quote)

---

## Success metrics (directional)

| Area            | Signal                                                      |
| --------------- | ----------------------------------------------------------- |
| Acquisition     | Quote requests, registrations                               |
| Delivery        | Projects on-time milestone rate                             |
| Billing         | MRR from subscriptions, invoice days-sales-outstanding      |
| Hosting/Domains | Provision success rate, sync drift                          |
| Support         | First response time, AI draft acceptance rate               |
| AI              | Groundedness (eval), approval SLA, cost per resolved ticket |
