# Platform Architecture

**Agency AI Platform** is a production SaaS operating system for a digital agency that sells web programming, design, branding, SEO, domains, hosting, maintenance, custom AI, and technical support.

This document defines system boundaries, runtime topology, package ownership, and integration rules. Companion docs:

| Doc                                        | Focus                                 |
| ------------------------------------------ | ------------------------------------- |
| [DATABASE.md](./DATABASE.md)               | MariaDB schema & Prisma conventions   |
| [API.md](./API.md)                         | REST & WebSocket contracts            |
| [SECURITY.md](./SECURITY.md)               | AuthN/Z, tenancy, secrets, audit      |
| [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) | Multi-agent AI, RAG, tools, approvals |
| [ROADMAP.md](./ROADMAP.md)                 | Phased delivery                       |

**Non-negotiables**

1. **MariaDB** is the only primary transactional database. Do **not** introduce PostgreSQL.
2. All third-party systems are accessed through **provider interfaces** (never call vendor SDKs from controllers or React apps).
3. Apps stay thin; domain logic lives in `packages/*`.
4. One NestJS API is the system of record for business operations.

---

## 1. Product surfaces

```text
┌─────────────────┐   ┌──────────────────┐   ┌─────────────────┐
│  Public Website │   │ Customer Portal  │   │ Admin Platform  │
│  (marketing +   │   │ (projects, bill, │   │ (CRM, ops, AI,  │
│   self-serve)   │   │  hosting, AI)    │   │  roles, audit)  │
└────────┬────────┘   └────────┬─────────┘   └────────┬────────┘
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   NestJS API + WS   │
                    │   (apps/api)        │
                    └─────────┬───────────┘
                              │
        ┌─────────────┬───────┼────────┬─────────────┐
        ▼             ▼       ▼        ▼             ▼
   MariaDB/Prisma   Redis   BullMQ   Object store   Providers
                                              (LLM, Stripe, WHM, …)
```

### 1.1 Public website (`apps/website`)

Unauthenticated / lightly authenticated marketing and acquisition:

- Company story, services, portfolio, blog, knowledge base
- Hosting plans, pricing, domain search
- Contact, request quote, customer registration & login entry

### 1.2 Customer portal (`apps/client-portal`)

Authenticated customer workspace:

- Dashboard, projects, tasks/milestones, files
- Quotes, contracts, invoices, payments, subscriptions
- Domains, DNS, hosting
- Support tickets, AI assistant, notifications, profile/security

### 1.3 Admin platform (`apps/admin`)

Internal employees (sales, PM, developers, designers, support, ops):

- Dashboard, CRM, leads, customers, sales pipeline
- Quotes, contracts, projects, tasks
- Employees / developers / designers roster
- Hosting, servers, domains, DNS, billing
- Support tickets, knowledge base CMS
- AI management, reports
- Roles, permissions, audit logs, system settings

### 1.4 AI platform (logical subsystem)

Not a separate deployable UI by default. Exposed through:

- Admin → AI management / approvals / evaluation
- Portal → customer AI assistant
- API workers → agent runs, RAG indexing, tool execution

See [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

## 2. Monorepo layout

```text
agency-ai-platform/
├── apps/
│   ├── website/           # React + Vite (public)
│   ├── client-portal/     # React + Vite (customer)
│   ├── admin/             # React + Vite (staff)
│   └── api/               # NestJS REST + WebSockets + workers entry
├── packages/
│   ├── ui/                # Design system
│   ├── database/          # Prisma schema, client, migrations (MariaDB)
│   ├── auth/              # Sessions, JWT, password/MFA helpers
│   ├── ai/                # Agents, RAG, providers, tool registry
│   ├── billing/           # Invoices, subscriptions, PaymentProvider
│   ├── hosting/           # HostingProvider (cPanel/WHM adapters)
│   ├── domains/           # DomainProvider + DNS adapters
│   ├── shared/            # Types, constants, result/error utilities
│   ├── email/             # EmailProvider (+ adapters)          [planned]
│   ├── storage/           # StorageProvider (+ adapters)        [planned]
│   ├── notifications/     # In-app + push fan-out               [planned]
│   └── queue/             # BullMQ job definitions/helpers     [planned]
├── docs/
├── docker/                # Compose, Nginx, MariaDB, Redis     [planned]
└── …
```

Planned packages are documented here so ownership is clear before code lands. Existing scaffold packages remain; new ones are added when a phase requires them ([ROADMAP.md](./ROADMAP.md)).

### 2.1 Dependency direction

```text
apps/website|client-portal|admin  →  ui, shared, auth(client), * SDK clients
apps/api                          →  all domain packages
packages/*                        →  shared (+ sibling packages without cycles)
packages/database                 →  Prisma only (no provider SDKs)
```

**Forbidden**

- App → app imports
- Controllers / React components → Stripe / OpenAI / WHM SDKs directly
- Any package introducing PostgreSQL clients or `pg` drivers

---

## 3. Runtime & infrastructure

| Component            | Role                                                                           |
| -------------------- | ------------------------------------------------------------------------------ |
| **Nginx**            | TLS termination, static assets, reverse proxy to Vite builds & API             |
| **API (NestJS)**     | HTTP REST, WebSockets (Socket.IO or native WS gateway), auth guards            |
| **Worker processes** | Same codebase, BullMQ consumers (email, RAG index, hosting sync, AI jobs)      |
| **MariaDB**          | System of record                                                               |
| **Redis**            | Sessions (optional), cache, BullMQ broker, rate limits, pub/sub for WS fan-out |
| **Object storage**   | Files, contract PDFs, ticket attachments (via `StorageProvider`)               |
| **Docker Compose**   | Local/dev & single-node staging; production may use same images on VMs/K8s     |

### 3.1 Process model

```text
nginx
 ├── website static
 ├── client-portal static
 ├── admin static
 └── /api  → api:3000
              ├── HTTP controllers
              ├── WS gateway
              └── (optional) embedded bull board / health

worker (one or more replicas)
 └── BullMQ queues: email, billing, hosting, domains, ai, search-index, webhooks
```

### 3.2 Environments

| Env        | MariaDB              | Redis         | Notes                                       |
| ---------- | -------------------- | ------------- | ------------------------------------------- |
| local      | Docker               | Docker        | Seed data; mock providers available         |
| staging    | Managed MariaDB      | Managed Redis | Real Stripe test + WHM sandbox if available |
| production | Managed MariaDB (HA) | Managed Redis | Live providers; stricter secrets            |

---

## 4. Provider architecture

Every external capability has a TypeScript interface in the owning package. Adapters implement the interface. Nest registers the concrete adapter via DI (`PROVIDER` tokens).

| Interface           | Package   | Default production adapter                                        | Purpose                                  |
| ------------------- | --------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `LLMProvider`       | `ai`      | OpenAI chat/completions                                           | Text generation, tool calling            |
| `EmbeddingProvider` | `ai`      | OpenAI embeddings                                                 | Chunk → vector                           |
| `VectorStore`       | `ai`      | MariaDB vector/JSON + Redis ANN _or_ file/blob index (see AI doc) | Similarity search **without PostgreSQL** |
| `PaymentProvider`   | `billing` | Stripe                                                            | Checkout, subscriptions, webhooks        |
| `HostingProvider`   | `hosting` | `CpanelWhmProvider` (WHM HTTP transport PLACEHOLDER)              | create / suspend / unsuspend / terminate / usage |
| `DomainProvider`    | `domains` | Registrar adapter(s) (interface shipped; SDK PLACEHOLDER)         | Search/register/transfer/renew + NS + DNS CRUD |
| `DnsProvider`       | `domains` | DNS subset type of `DomainProvider`                               | Record CRUD (same adapter or dedicated)  |
| `EmailProvider`     | `email`   | Transactional ESP (e.g. SES/Postmark/SendGrid)                    | Transactional mail                       |
| `StorageProvider`   | `storage` | S3-compatible                                                     | Files & artifacts                        |

**Rules**

1. Interfaces accept/return **domain DTOs**, not vendor types.
2. Webhooks enter via Nest controllers, normalize to domain events, then call package services.
3. Each adapter is unit-testable with fakes; integration tests hit sandboxes behind feature flags.
4. Switching vendors = new adapter + DI binding; no controller changes.

---

## 5. Domain modules (API)

Nest modules map to business capabilities (illustrative):

| Module                | Owns                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `IdentityModule`      | Users, credentials, MFA, sessions                                                                                       |
| `CrmModule`           | Leads, customers, companies, pipeline                                                                                   |
| `CatalogModule`       | Services, hosting plans, pricing                                                                                        |
| `SalesModule`         | Quotes, contracts                                                                                                       |
| `ProjectsModule`      | Project → Milestone → Task → Subtask; status pipeline New → Maintenance; comments, attachments, time, members, activity |
| `BillingModule`       | Products, Prices, Invoices, Subscriptions, Payments, Refund workflow, Webhooks via `PaymentProvider`                    |
| `DomainsModule`       | Domains, DNS                                                                                                            |
| `HostingModule`       | Hosting accounts, servers, sync jobs                                                                                    |
| `SupportModule`       | SupportTicket + messages/assignments; KnowledgeArticle/Category/Document/Chunk/Revision                                 |
| `CmsModule`           | Blog, portfolio, public pages content                                                                                   |
| `NotificationsModule` | In-app notifications, preferences                                                                                       |
| `AiModule`            | Agents, runs, RAG, approvals, eval                                                                                      |
| `RbacModule`          | Roles, permissions                                                                                                      |
| `AuditModule`         | Immutable audit log writes/queries                                                                                      |
| `SettingsModule`      | System settings                                                                                                         |
| `ReportsModule`       | Aggregations / exports                                                                                                  |

Public website reads CMS/catalog/KB via public endpoints; mutations that create leads/quotes go through sales/CRM modules.

---

## 6. Cross-cutting patterns

### 6.1 Request flow

```text
Client → Nginx → Nest Guard (auth + RBAC) → Pipe (validation)
      → Service (domain) → Prisma / Provider / Queue
      → DTO mapper → HTTP/WS response
      → Audit + metrics (side effects)
```

### 6.2 Async work

Use BullMQ for anything that is:

- Slow (WHM API, registrar, RAG indexing)
- Retriable (email, webhooks outbound)
- Dangerous to block HTTP (AI tool runs with human approval wait)

### 6.3 Realtime

WebSockets for:

- Ticket / project activity
- Notification badge updates
- AI assistant streaming tokens
- Admin AI approval queue updates

### 6.4 Multi-tenancy model

- **Organization (Customer account)** is the tenancy boundary for portal data.
- Staff users belong to the **Agency** tenant and access many organizations via RBAC.
- Row-level checks: every customer-scoped query filters by `organizationId` (see SECURITY + DATABASE).

### 6.5 Commercial lifecycle

```text
Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services
```

Domain tables and `@agency/shared` `COMMERCIAL_LIFECYCLE` encode this path. Recurring Services maps to the `Subscription` model (hosting, retainers, maintenance).

### 6.6 Idempotency

Provider webhooks and payment intents use idempotency keys stored in MariaDB.

---

## 7. Frontend architecture

| Concern   | Approach                                                    |
| --------- | ----------------------------------------------------------- |
| Framework | React + Vite + TypeScript                                   |
| Routing   | Per-app router (public vs portal vs admin route trees)      |
| Data      | Typed API client generated or hand-maintained from OpenAPI  |
| Auth      | HttpOnly cookies or Bearer tokens per SECURITY.md           |
| UI        | `@agency/ui` design system; no business logic in UI package |
| Forms     | Schema-validated (shared zod/types where possible)          |
| AI UX     | Streaming over WS/SSE; approval states surfaced in admin    |

Apps never talk to MariaDB, Redis, or providers directly.

---

## 8. Observability

- Structured JSON logs (request id, organization id, actor id)
- Metrics: HTTP latency, queue depth, AI token usage, provider error rates
- Tracing: optional OpenTelemetry across API + workers
- Audit log is **business** history; APM is **operational** history (do not conflate)

---

## 9. Deployment sketch

```text
[Internet]
    │
  Nginx (TLS)
    ├── /                → website
    ├── /app             → client-portal
    ├── /admin           → admin
    └── /api             → Nest API
              │
              ├── MariaDB
              ├── Redis
              └── Worker(s)
```

Secrets via environment / secret manager only. Prisma migrations run as a controlled release step.

---

## 10. What this phase does _not_ include

Per product direction: **no production application implementation yet**. This documentation set is the contract for subsequent implementation phases defined in [ROADMAP.md](./ROADMAP.md).
