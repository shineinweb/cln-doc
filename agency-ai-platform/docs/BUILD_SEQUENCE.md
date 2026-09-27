# Build sequence (01 → 30)

Canonical implementation order for the Agency AI Platform.

```text
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
```

Encoded in `@agency/shared` as `BUILD_SEQUENCE` / `BUILD_SEQUENCE_DIAGRAM`.  
Related: [ROADMAP.md](./ROADMAP.md) (phase narrative), [DEPLOYMENT.md](./DEPLOYMENT.md) (29–30 ops path).

---

## Status legend

| Status        | Meaning                                             |
| ------------- | --------------------------------------------------- |
| `complete`    | Scaffold/docs/controls landed for the step’s intent |
| `in_progress` | Partial (schema, UI shell, provider stub, or APIs)  |
| `planned`     | Not started or only named in roster/docs            |

Statuses are updated as vertical slices ship. **Production (30)** always requires manual approval.

---

## Steps

| #   | Step                      | Status      | Notes                                                               |
| --- | ------------------------- | ----------- | ------------------------------------------------------------------- |
| 01  | Architecture              | complete    | `docs/*` contracts                                                  |
| 02  | Cursor Rules              | complete    | `AGENTS.md`, `DEVELOPMENT_RULES.md`, `.cursor/rules`                |
| 03  | Monorepo                  | complete    | pnpm apps + packages                                                |
| 04  | MariaDB + Redis           | complete    | Docker Compose                                                      |
| 05  | Prisma                    | complete    | `@agency/database`                                                  |
| 06  | Authentication            | complete    | Sessions; MFA still open ([SECURITY_AUDIT.md](./SECURITY_AUDIT.md)) |
| 07  | Roles & Permissions       | complete    | Catalog + guards + tenant helpers                                   |
| 08  | Public React/Vite Website | complete    | Site shell                                                          |
| 09  | CRM                       | in_progress | Schema + admin shells; APIs pending                                 |
| 10  | Projects                  | in_progress | Hierarchy + status pipeline                                         |
| 11  | Quotes/Contracts          | in_progress | Quote constants + schema                                            |
| 12  | Billing                   | in_progress | Provider, refunds, webhook verify                                   |
| 13  | Customer Portal           | in_progress | Welcome dashboard + domain shells                                   |
| 14  | Hosting                   | in_progress | `HostingProvider` + portal cards                                    |
| 15  | Domains/DNS               | in_progress | Provider interfaces PLACEHOLDER                                     |
| 16  | Support Tickets           | in_progress | Schema + portal forms                                               |
| 17  | Knowledge Base            | in_progress | Schema + capture pipeline                                           |
| 18  | AI Foundation             | in_progress | Nest → AiService → LLM (transport PLACEHOLDER)                      |
| 19  | AI Supervisor             | in_progress | Org chart / roster                                                  |
| 20  | Customer Support AI       | in_progress | Support tools registered                                            |
| 21  | Coding AI                 | in_progress | Tools + delivery pipeline                                           |
| 22  | Hosting AI                | in_progress | Diagnostic pipeline + approvals                                     |
| 23  | Sales/SEO AI              | planned     | Roster only                                                         |
| 24  | AI Learning System        | in_progress | Knowledge/memory/eval stubs                                         |
| 25  | AI Control Center         | in_progress | `/admin/ai` sections                                                |
| 26  | Reports/Analytics         | planned     | Today dashboard placeholders                                        |
| 27  | Testing                   | in_progress | Vitest + CI workflow                                                |
| 28  | Security Audit            | complete    | `SECURITY_AUDIT.md` (remediate High next)                           |
| 29  | Staging                   | in_progress | Release workflow PLACEHOLDER deploy                                 |
| 30  | Production                | planned     | After manual approval only                                          |

---

## How to use this sequence

1. Do not skip foundations (01–08) when adding product surface.
2. Prefer finishing an `in_progress` vertical slice (API + UI + tests) before opening the next `planned` AI specialist.
3. Steps 27–28 gate 29–30: tests + security findings addressed before staging soak and production promote.
4. Coding AI must never jump to **30 Production** (see Coding AI pipeline + [DEPLOYMENT.md](./DEPLOYMENT.md)).
