# Database Architecture (MariaDB + Prisma)

MariaDB is the **only** primary transactional database for the Agency AI Platform. Prisma ORM is the exclusive data-access layer used by application code (`@agency/database`).

**Do not introduce PostgreSQL**, Timescale, or `pg`-based tooling.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md).

---

## 1. Principles

1. **Single source of truth** — business state lives in MariaDB.
2. **Prisma schema** lives in `packages/database` and owns migrations.
3. **Organization-scoped tenancy** — customer data always carries `organizationId`.
4. **Hard deletes are rare** — prefer `deletedAt` soft deletes for CRM/content; hard delete only for ephemeral/cache rows or GDPR erasure jobs.
5. **Money as integers** — store currency amounts in **minor units** (`amountCents`) + ISO `currency`.
6. **Provider payloads isolated** — raw Stripe/WHM/registrar JSON in dedicated `*ProviderEvent` / `externalRef` columns, not smeared across domain tables.
7. **Vectors without Postgres** — embeddings stored in MariaDB (see §8); optional Redis/ANN cache later. No `pgvector`.

---

## 2. Prisma / MariaDB configuration

```prisma
// packages/database/prisma/schema.prisma (target shape — not implemented in this docs phase)

datasource db {
  provider = "mysql"   // Prisma dialect for MariaDB
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**Connection URL** uses the MySQL protocol, e.g.:

```text
mysql://USER:PASS@HOST:3306/agency_ai?connection_limit=10
```

**Charset / collation:** `utf8mb4` / `utf8mb4_unicode_ci` for all tables.

**Engine:** InnoDB only (transactions, FKs, row locks).

---

## 3. Identity & access

| Model                | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `User`               | Any login identity (customer or staff)                 |
| `Credential`         | Password hash, MFA secrets (encrypted), recovery codes |
| `Session`            | Server-side session / refresh metadata                 |
| `Organization`       | Customer company / billing account (tenant)            |
| `OrganizationMember` | User ↔ org membership + portal role                    |
| `EmployeeProfile`    | Staff profile (title, department, capacity)            |
| `Role`               | Named role (`customer_admin`, `sales`, `developer`, …) |
| `Permission`         | Fine-grained permission string                         |
| `RolePermission`     | M2M                                                    |
| `UserRole`           | Staff user ↔ role (agency-scoped)                      |
| `ApiKey`             | Machine keys for limited integrations (hashed)         |

**Notes**

- A user may be a member of multiple organizations (rare; supported).
- Staff users have `UserRole`s; portal users use `OrganizationMember.role`.
- Permission checks compose both (see SECURITY.md).

---

## 4. CRM & sales

| Model                | Purpose                                              |
| -------------------- | ---------------------------------------------------- |
| `Lead`               | Unqualified / inbound interest                       |
| `LeadActivity`       | Calls, emails, notes, status changes                 |
| `Customer`           | Optional profile projection linked to `Organization` |
| `PipelineStage`      | Sales stages                                         |
| `Opportunity`        | Deal in pipeline                                     |
| `Quote`              | Formal quote                                         |
| `QuoteLineItem`      | Line items (service, qty, unit price)                |
| `Contract`           | Signed/pending contract                              |
| `ContractVersion`    | Immutable PDF/HTML snapshots                         |
| `ServiceCatalogItem` | Sellable services (web design, SEO, …)               |
| `HostingPlan`        | Hosting SKUs (mapped to WHM packages)                |

**Lead → customer conversion** creates/links `Organization`, memberships, and optionally an `Opportunity` / first `Project`.

---

## 5. Delivery (projects)

| Model         | Purpose                                |
| ------------- | -------------------------------------- |
| `Project`     | Delivery container for an organization |
| `Milestone`   | Phase / milestone                      |
| `Task`        | Work item; assignee can be staff user  |
| `TaskComment` | Discussion                             |
| `ProjectFile` | Metadata for files in object storage   |
| `TimeEntry`   | Optional time tracking for reporting   |

Statuses are enums in Prisma (`ProjectStatus`, `TaskStatus`, …) mirrored in `@agency/shared`.

---

## 6. Billing

| Model              | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `Invoice`          | Invoice header                                      |
| `InvoiceLineItem`  | Lines                                               |
| `Payment`          | Successful/failed payment attempts                  |
| `Subscription`     | Recurring product (hosting, maintenance, retainers) |
| `SubscriptionItem` | Items within a subscription                         |
| `PaymentMethod`    | Tokenized PM references (no raw PAN)                |
| `BillingCustomer`  | Mapping org → `PaymentProvider` customer id         |
| `WebhookEvent`     | Idempotent provider webhook inbox                   |

**Stripe** is an adapter behind `PaymentProvider`. Domain tables stay provider-agnostic via `provider` + `externalId` fields.

---

## 7. Domains & hosting

| Model            | Purpose                               |
| ---------------- | ------------------------------------- |
| `Domain`         | Registered or managed domain          |
| `DomainOrder`    | Search/register/transfer workflow     |
| `DnsZone`        | Zone ownership                        |
| `DnsRecord`      | Individual records                    |
| `Server`         | WHM/server inventory                  |
| `HostingAccount` | cPanel account (or equivalent)        |
| `HostingPackage` | Local mirror of remote package        |
| `HostingAction`  | Async action log (create, suspend, …) |

Sync jobs reconcile local state with `HostingProvider` / `DomainProvider` / `DnsProvider`.

---

## 8. Support, CMS, notifications

| Model                     | Purpose                             |
| ------------------------- | ----------------------------------- |
| `Ticket`                  | Support ticket                      |
| `TicketMessage`           | Thread messages (staff/customer/AI) |
| `TicketAttachment`        | File refs                           |
| `KnowledgeArticle`        | KB article (public and/or internal) |
| `KnowledgeArticleVersion` | Version history                     |
| `BlogPost`                | Public blog                         |
| `PortfolioItem`           | Case studies                        |
| `Notification`            | In-app notification                 |
| `NotificationPreference`  | Per-user channel prefs              |
| `ContactRequest`          | Public contact form submissions     |
| `QuoteRequest`            | Public “request quote” submissions  |

---

## 9. AI & RAG persistence (MariaDB)

| Model                | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `AiAgent`            | Agent definition (Support, Coding, …)                              |
| `AiAgentVersion`     | Prompt/tool config versions                                        |
| `AiConversation`     | Thread (portal/admin/system)                                       |
| `AiMessage`          | Role/content/tool calls                                            |
| `AiRun`              | Single agent execution                                             |
| `AiToolCall`         | Tool invocation + args/result                                      |
| `AiApproval`         | Human-in-the-loop gate                                             |
| `AiMemory`           | Long-lived memory items (scoped)                                   |
| `AiFeedback`         | Thumbs / ratings / comments                                        |
| `AiEvaluation`       | Offline/online eval records                                        |
| `KnowledgeSource`    | RAG source (KB, ticket, file, URL)                                 |
| `KnowledgeChunk`     | Chunk text + metadata                                              |
| `KnowledgeEmbedding` | Embedding vector storage                                           |
| `AiAuditEvent`       | AI-specific audit (also mirrored to platform audit where required) |

### 9.1 Embedding storage strategy (no PostgreSQL)

**v1 (required):** store embeddings in MariaDB:

- Column `embedding Json` (number array) **or** `VARBINARY`/`BLOB` of float32
- Metadata columns for filter (`organizationId`, `sourceType`, `sourceId`)
- Similarity search: worker-side cosine over filtered candidate sets; acceptable for early scale

**v2 (optional):** Redis or dedicated ANN service **in front of** MariaDB as a cache/index — MariaDB remains source of truth for chunk text + embedding bytes.

**Forbidden:** `pgvector`, PostgreSQL, or moving system of record for chunks to a second SQL engine.

---

## 10. Platform / audit / settings

| Model           | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `AuditLog`      | Append-only business audit                                        |
| `SystemSetting` | Key/value configuration                                           |
| `FeatureFlag`   | Optional toggles                                                  |
| `OutboxEvent`   | Transactional outbox for reliable messaging                       |
| `JobDeadLetter` | Optional DLQ metadata (BullMQ is primary; DB for support tooling) |

`AuditLog` columns (minimum): `id`, `actorUserId`, `actorType`, `organizationId?`, `action`, `entityType`, `entityId`, `beforeJson?`, `afterJson?`, `ip`, `userAgent`, `createdAt`.

---

## 11. Entity relationship (conceptual)

```text
User ──┬── OrganizationMember ── Organization ──┬── Project ── Task
       │                                        ├── Invoice / Subscription
       │                                        ├── Domain / HostingAccount
       │                                        ├── Ticket
       │                                        └── AiConversation
       │
       └── UserRole ── Role ── Permission     (staff)

Lead ──▶ Organization (conversion)
Quote ──▶ Contract ──▶ Project / Subscription
KnowledgeArticle ──▶ KnowledgeChunk ──▶ KnowledgeEmbedding
AiRun ── AiToolCall ── AiApproval
```

---

## 12. Indexing guidelines

| Area    | Indexes                                                                           |
| ------- | --------------------------------------------------------------------------------- |
| Tenancy | `(organizationId, createdAt)` on major entities                                   |
| Auth    | unique `User.email`; `Session.tokenHash`                                          |
| Billing | `(provider, externalId)` unique where applicable                                  |
| Domains | unique `Domain.fqdn`                                                              |
| Tickets | `(organizationId, status, updatedAt)`                                             |
| AI      | `(conversationId, createdAt)` on messages; embeddings by `(sourceType, sourceId)` |
| Audit   | `(createdAt)`, `(organizationId, createdAt)`, `(entityType, entityId)`            |

Use composite indexes matching real list/filter queries from admin & portal.

---

## 13. Migrations & seeding

1. All schema changes via Prisma Migrate (`packages/database`).
2. Migrations are reviewed in PRs; never hand-edit production schema.
3. Seeds: roles/permissions, hosting plans, demo org (dev only), system AI agents.
4. Data backfills run as versioned scripts/jobs, not ad-hoc SQL in prod.

---

## 14. Multi-DB policy

| Store                                 | Allowed?     | Use                                          |
| ------------------------------------- | ------------ | -------------------------------------------- |
| MariaDB                               | **Required** | System of record                             |
| Redis                                 | Yes          | Cache, queues, rate limits, optional session |
| Object storage                        | Yes          | Blobs                                        |
| PostgreSQL                            | **No**       | —                                            |
| Secondary SQL (MySQL/MariaDB replica) | Yes          | Read replicas only                           |

---

## 15. Naming conventions

- Models: `PascalCase` singular (`Invoice`)
- Tables: Prisma default or explicit `@@map("invoices")` snake plural
- Enums: Prisma enums; values `SCREAMING_SNAKE` or documented mapping in shared
- Soft delete: `deletedAt DateTime?`
- Timestamps: `createdAt`, `updatedAt` on all durable entities
