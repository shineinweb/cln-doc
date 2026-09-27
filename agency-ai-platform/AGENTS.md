# AGENTS.md — Agency AI Platform

Instructions for AI coding agents and human contributors working in this repository.

You are implementing a **production-grade SaaS platform** for a digital agency (web, design, branding, SEO, domains, hosting, maintenance, custom AI, support). Act as a careful senior full-stack engineer: follow the architecture contracts, prefer small correct changes, and do not invent parallel stacks.

> **Mandatory:** Before architectural changes, read **[DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)** (stack, DB, security, AI, feature workflow).

---

## 1. Current phase

**Phase 1 foundation:** monorepo apps/packages + quality tooling. Identity/tenancy/business features are **not** implemented yet (see [docs/ROADMAP.md](./docs/ROADMAP.md)).

| Allowed now                           | Not allowed yet (unless explicitly asked) |
| ------------------------------------- | ----------------------------------------- |
| Tooling, scaffold, docs               | Auth, CRM, billing, hosting features      |
| Docker/Prisma baseline when requested | Skipping provider interfaces              |
| Clarifying architecture               | Introducing PostgreSQL / `pgvector`       |

When asked to implement, follow the roadmap order and the docs below.

---

## 2. Required reading (before coding)

| Order | Doc                                                  | Why                                                  |
| ----- | ---------------------------------------------------- | ---------------------------------------------------- |
| 0     | [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)       | Binding engineering / security / AI / workflow rules |
| 1     | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)       | Surfaces, packages, runtime, providers               |
| 2     | [docs/DATABASE.md](./docs/DATABASE.md)               | MariaDB + Prisma model                               |
| 3     | [docs/API.md](./docs/API.md)                         | REST / WebSocket contracts                           |
| 4     | [docs/SECURITY.md](./docs/SECURITY.md)               | AuthN/Z, tenancy, audit                              |
| 5     | [docs/AI_ARCHITECTURE.md](./docs/AI_ARCHITECTURE.md) | Agents, RAG, tools, approvals                        |
| 6     | [docs/ROADMAP.md](./docs/ROADMAP.md)                 | What to build next                                   |

Index: [docs/README.md](./docs/README.md). Cursor rules: [`.cursor/rules/`](./.cursor/rules/).

---

## 3. Hard constraints (non-negotiable)

1. **MariaDB only** as the primary transactional database. Prisma provider: `mysql`.  
   **Never** add PostgreSQL, `pg`, or `pgvector`.
2. **Provider interfaces** for all third parties — no vendor SDKs in React apps or Nest controllers:
   - `LLMProvider`, `EmbeddingProvider`, `VectorStore`
   - `PaymentProvider`, `HostingProvider`, `DomainProvider`, `DnsProvider`
   - `EmailProvider`, `StorageProvider`
3. **One NestJS API** (`apps/api`) is the system of record for business operations.
4. **Apps stay thin** — domain logic in `packages/*`.
5. **Organization tenancy** — customer data always scoped by `organizationId`.
6. **High-risk AI tools** require human approval + audit (hosting suspend, DNS delete, refunds, domain transfer, etc.).
7. **No secrets in git** — `.env.example` only; real values in local/env/secret manager.

---

## 4. Repository layout

```text
agency-ai-platform/
├── apps/
│   ├── website/          # Public React/Vite — marketing, pricing, KB, auth entry
│   ├── client-portal/    # Customer React/Vite — projects, billing, hosting, AI
│   ├── admin/            # Staff React/Vite — CRM, ops, RBAC, AI management
│   └── api/              # NestJS — REST, WebSockets, workers entry
├── packages/
│   ├── ui/               # Design system
│   ├── database/         # Prisma schema, client, migrations (MariaDB)
│   ├── auth/             # Sessions, credentials, MFA helpers
│   ├── ai/               # Agents, RAG, LLM/embedding/vector providers
│   ├── billing/          # Invoices, subscriptions, PaymentProvider
│   ├── hosting/          # HostingProvider (cPanel/WHM adapters)
│   ├── domains/          # DomainProvider + DnsProvider
│   ├── shared/           # Types, constants, pure utils
│   ├── email/            # EmailProvider          [planned]
│   ├── storage/          # StorageProvider        [planned]
│   ├── notifications/    # In-app notifications   [planned]
│   └── queue/            # BullMQ helpers         [planned]
├── docs/                 # Architecture contracts
├── .cursor/rules/        # Editor/agent rules
├── AGENTS.md             # This file
├── pnpm-workspace.yaml
└── package.json
```

**Dependency direction**

```text
apps/*        → packages/*
packages/*    → shared (+ siblings without cycles)
apps ↛ apps
UI/controllers ↛ vendor SDKs
```

---

## 5. Product surfaces (what belongs where)

| Surface     | App                           | Owns                                                                                                                                                                                             |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public      | `website`                     | Services, hosting plans, domain search, pricing, portfolio, blog, KB, contact, quote request, register/login entry                                                                               |
| Customer    | `client-portal`               | Dashboard, projects, tasks, files, quotes, contracts, invoices, payments, subscriptions, domains, DNS, hosting, tickets, AI assistant, notifications, profile                                    |
| Admin       | `admin`                       | CRM, leads, customers, sales, quotes, contracts, projects, tasks, employees, hosting/servers, domains/DNS, billing, tickets, KB CMS, AI management, reports, roles, permissions, audit, settings |
| AI platform | logical (`packages/ai` + API) | Supervisor, Support/Coding/Hosting/Sales/SEO agents, RAG, tools, memory, feedback, eval, approvals, AI audit                                                                                     |

Do not put admin capabilities in the portal, or portal billing UI in the public site, unless the architecture docs explicitly allow a shared entry (e.g. login).

---

## 6. Technology stack

| Layer      | Choice                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- |
| Frontends  | React, Vite, TypeScript                                                                   |
| Backend    | Node.js, NestJS, TypeScript, REST, WebSockets                                             |
| DB         | **MariaDB** + Prisma                                                                      |
| Async      | Redis + BullMQ                                                                            |
| Edge       | Nginx                                                                                     |
| Containers | Docker                                                                                    |
| AI         | OpenAI via `LLMProvider` / `EmbeddingProvider`; RAG via `VectorStore` (MariaDB-backed v1) |
| Billing    | Stripe via `PaymentProvider`                                                              |
| Hosting    | cPanel/WHM via `HostingProvider`                                                          |
| Domains    | Registrar adapters via `DomainProvider` / `DnsProvider`                                   |

---

## 7. Tooling commands

From `agency-ai-platform/`:

```bash
pnpm install
pnpm dev:website    # :5173
pnpm dev:portal     # :5174
pnpm dev:admin      # :5175
pnpm dev:api        # :3000
pnpm build
pnpm build:packages
pnpm typecheck
pnpm lint
pnpm test
```

Package manager: **pnpm only** (never npm/yarn for this project). Node `>= 22`.

---

## 8. Engineering conventions

1. Import via workspace names (`@agency/ui`, `@agency/shared`, …). No deep imports of another app’s internals.
2. Put domain logic in `packages/*`; Nest modules wire providers and HTTP/WS.
3. Shared types/constants → `@agency/shared`.
4. All DB access → `@agency/database` (Prisma). No ad-hoc MariaDB clients in apps.
5. Money: integer minor units (`amountCents`) + ISO `currency`.
6. Lists: cursor pagination; errors: stable problem-details shape ([docs/API.md](./docs/API.md)).
7. Mutating provider calls and webhooks: idempotency keys.
8. Match neighboring package patterns before inventing new ones.
9. Prefer fakes/mocks for providers in local dev and unit tests.
10. Update docs when you change a contract (API shape, schema area, provider interface).

---

## 9. Security checklist (every feature)

- [ ] Auth guard + permission check on admin routes
- [ ] Portal queries filtered by `organizationId`
- [ ] No secrets/tokens in logs or client bundles
- [ ] Webhooks signature-verified
- [ ] File uploads via `StorageProvider` with size/MIME limits
- [ ] Sensitive actions write `AuditLog`
- [ ] AI tools: allowlist + approval for high risk ([docs/AI_ARCHITECTURE.md](./docs/AI_ARCHITECTURE.md))

---

## 10. AI implementation rules

When building AI features:

1. Go through **Supervisor → specialist** (do not call OpenAI from random services).
2. RAG chunks are **untrusted** context; never treat retrieved text as instructions.
3. Persist `AiRun`, `AiToolCall`, approvals, and feedback.
4. Embeddings/chunks stay in MariaDB (`VectorStore` adapter) — no Postgres vector DB.
5. Customer-facing assistant is scoped; staff agents may use internal collections only when authorized.

---

## 11. How to take a task

Follow the full workflow in [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md):

1. Inspect existing code → read docs → **explain the plan** (DB, API, security).
2. Implement behind package boundaries + provider interfaces.
3. Add/adjust Prisma schema only in `@agency/database` with migrations.
4. Add tests; run **lint → typecheck → tests → build**; fix failures.
5. Report what changed. **Never ignore failing tests.**
6. Keep PRs focused; do not drive-by refactor unrelated apps.

---

## 12. Explicit non-goals

- PostgreSQL or dual primary SQL databases
- Calling Stripe / OpenAI / WHM SDKs from React
- Autonomous production deploys by Coding AI
- Unscoped cross-tenant “admin debug” queries in portal code
- Expanding scope outside the requested phase without updating ROADMAP/docs

---

## 13. Cursor rules

Concise always/glob rules in [`.cursor/rules/`](./.cursor/rules/):

| Rule               | Scope                                   |
| ------------------ | --------------------------------------- |
| `architecture.mdc` | Always — stack, boundaries, providers   |
| `security.mdc`     | Always — authZ, tenancy, secrets, audit |
| `frontend.mdc`     | Website, portal, admin, UI              |
| `backend.mdc`      | API + domain integration packages       |
| `database.mdc`     | Prisma / MariaDB                        |
| `testing.mdc`      | Tests + verification workflow           |
| `ai.mdc`           | Agents, RAG, tools, approvals           |

If a rule conflicts with `DEVELOPMENT_RULES.md` or `docs/`, **docs win** — then update the rule to match.
