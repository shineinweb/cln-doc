# API Architecture

The NestJS application (`apps/api`) exposes a versioned **REST** API and **WebSocket** channels. Frontends (`website`, `client-portal`, `admin`) are the only first-party consumers; third parties use constrained API keys if enabled later.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

## 1. Base conventions

| Item        | Convention                                                                                   |
| ----------- | -------------------------------------------------------------------------------------------- |
| Base path   | `/api/v1`                                                                                    |
| Format      | JSON (`application/json`)                                                                    |
| Errors      | RFC 7807-inspired problem details (`type`, `title`, `status`, `detail`, `code`, `requestId`) |
| Auth        | Session cookie and/or `Authorization: Bearer` (see SECURITY)                                 |
| IDs         | Opaque string IDs (ULID/UUID)                                                                |
| Time        | ISO-8601 UTC                                                                                 |
| Money       | Integer minor units + `currency`                                                             |
| Pagination  | Cursor (`?cursor=&limit=`) for lists; `limit` max enforced                                   |
| Idempotency | `Idempotency-Key` header on payments, domain register, hosting create                        |
| Versioning  | URL prefix `/v1`; breaking changes → `/v2`                                                   |

### 1.1 Standard response envelopes

**Single resource**

```json
{
  "data": { "id": "…", "type": "project", "attributes": {} }
}
```

**List**

```json
{
  "data": [{ "id": "…", "type": "project", "attributes": {} }],
  "meta": { "nextCursor": "…", "limit": 25 }
}
```

Slight nesting (`data` / `attributes`) keeps room for `included` relationships later without a full JSON:API mandate. DTOs are defined in Nest and shared types in `@agency/shared`.

### 1.2 Error shape

```json
{
  "type": "https://api.agency.example/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid",
  "code": "VALIDATION_ERROR",
  "requestId": "req_…",
  "errors": [{ "field": "email", "message": "Invalid email" }]
}
```

---

## 2. Audience & route prefixes

| Prefix               | Audience                      | Apps                    |
| -------------------- | ----------------------------- | ----------------------- |
| `/api/v1/public/…`   | Anonymous / marketing         | website                 |
| `/api/v1/auth/…`     | Auth flows                    | all                     |
| `/api/v1/portal/…`   | Organization members          | client-portal           |
| `/api/v1/admin/…`    | Staff with RBAC               | admin                   |
| `/api/v1/webhooks/…` | Provider callbacks            | Stripe, registrar, etc. |
| `/api/v1/internal/…` | Service-to-service (optional) | workers                 |

Portal routes always resolve the active `organizationId` (header `X-Organization-Id` or membership default). Admin routes require permissions (see SECURITY).

---

## 3. Public API (website)

| Method | Path                        | Purpose                    |
| ------ | --------------------------- | -------------------------- |
| GET    | `/public/services`          | Service catalog            |
| GET    | `/public/hosting-plans`     | Hosting plans & pricing    |
| GET    | `/public/portfolio`         | Portfolio items            |
| GET    | `/public/portfolio/:slug`   | Portfolio detail           |
| GET    | `/public/blog`              | Blog index                 |
| GET    | `/public/blog/:slug`        | Blog post                  |
| GET    | `/public/kb`                | Knowledge base index       |
| GET    | `/public/kb/:slug`          | KB article                 |
| GET    | `/public/domains/search?q=` | Domain availability search |
| POST   | `/public/contact`           | Contact form               |
| POST   | `/public/quote-requests`    | Request quote              |
| POST   | `/public/leads`             | Lightweight lead capture   |

Public write endpoints are rate-limited and CAPTCHA/bot-protected where appropriate.

---

## 4. Auth API

| Method | Path                    | Purpose                    |
| ------ | ----------------------- | -------------------------- |
| POST   | `/auth/register`        | Customer registration      |
| POST   | `/auth/login`           | Login                      |
| POST   | `/auth/logout`          | Logout                     |
| POST   | `/auth/refresh`         | Refresh session/token      |
| POST   | `/auth/forgot-password` | Start reset                |
| POST   | `/auth/reset-password`  | Complete reset             |
| POST   | `/auth/mfa/setup`       | Begin MFA enrollment       |
| POST   | `/auth/mfa/verify`      | Verify MFA                 |
| GET    | `/auth/me`              | Current user + memberships |

Registration creates `User` + default `Organization` + `OrganizationMember` (owner).

---

## 5. Customer portal API

All routes under `/portal` require authenticated org membership.

### 5.1 Core

| Area          | Endpoints (representative)                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard     | `GET /portal/dashboard`                                                                                                                                              |
| Profile       | `GET/PATCH /portal/profile`, `POST /portal/security/password`, MFA routes                                                                                            |
| Notifications | `GET /portal/notifications`, `POST /portal/notifications/:id/read`                                                                                                   |
| Projects      | `GET/POST /portal/projects`, `GET /portal/projects/:id`                                                                                                              |
| Tasks         | `GET /portal/projects/:id/tasks`, `PATCH /portal/tasks/:id` (limited fields)                                                                                         |
| Files         | `GET/POST /portal/projects/:id/files`, signed upload via `StorageProvider`                                                                                           |
| Quotes        | `GET /portal/quotes`, `GET /portal/quotes/:id` (View), `POST /portal/quotes/:id/accept`, `POST /portal/quotes/:id/reject`, `POST /portal/quotes/:id/request-changes` |
| Contracts     | `GET /portal/contracts`, `POST /portal/contracts/:id/sign`                                                                                                           |
| Invoices      | `GET /portal/invoices`, `GET /portal/invoices/:id`                                                                                                                   |
| Payments      | `POST /portal/invoices/:id/pay`, `GET /portal/payment-methods`                                                                                                       |
| Subscriptions | `GET /portal/subscriptions`, `POST /portal/subscriptions/:id/cancel`                                                                                                 |
| Domains       | `GET /portal/domains`, `POST /portal/domains/orders`                                                                                                                 |
| DNS           | `GET/POST/PATCH/DELETE /portal/domains/:id/dns/records`                                                                                                              |
| Hosting       | `GET /portal/hosting`, `POST /portal/hosting/:id/actions` (e.g. password reset request)                                                                              |
| Tickets       | `GET/POST /portal/tickets`, `GET/POST /portal/tickets/:id/messages`                                                                                                  |
| AI assistant  | `POST /portal/ai/conversations`, `POST /portal/ai/conversations/:id/messages`                                                                                        |

**AI completion (shared):** authenticated `POST /api/v1/ai/complete` — React → Nest `AiController` → `AiService` → `LLMProvider` → OpenAI transport (PLACEHOLDER → 503 until wired). Conversation routes above wrap this stack later.

Customer task updates are restricted (comment, attach, mark done if policy allows)—no reassignment of staff.

### 5.2 Domain search (authenticated)

`GET /portal/domains/search?q=` may expose richer pricing than public search.

---

## 6. Admin API

All routes under `/admin` require staff authentication + permission checks.

| Area                  | Endpoints (representative)                                |
| --------------------- | --------------------------------------------------------- |
| Dashboard             | `GET /admin/dashboard`                                    |
| CRM / leads           | CRUD `/admin/leads`, activities, convert                  |
| Customers             | CRUD `/admin/organizations`, members                      |
| Sales / opportunities | `/admin/opportunities`                                    |
| Quotes / contracts    | full lifecycle + send/sign workflows                      |
| Projects / tasks      | full CRUD, assignments                                    |
| Employees             | `/admin/employees`, capacity, roles assignment            |
| Hosting / servers     | `/admin/servers`, `/admin/hosting-accounts`, sync actions |
| Domains / DNS         | admin overrides + registrar ops                           |
| Billing               | invoices, subscriptions, refunds (via provider)           |
| Support               | tickets, assignment, internal notes                       |
| Knowledge base        | article CMS + publish                                     |
| AI management         | agents, runs, memories, evals, approvals                  |
| Reports               | `/admin/reports/...`                                      |
| RBAC                  | `/admin/roles`, `/admin/permissions`                      |
| Audit                 | `GET /admin/audit-logs`                                   |
| Settings              | `/admin/settings`                                         |

Destructive provider actions (suspend hosting, transfer domain) require elevated permissions and produce audit entries.

---

## 7. Webhooks

| Path                     | Provider                     |
| ------------------------ | ---------------------------- |
| `POST /webhooks/stripe`  | Stripe (`PaymentProvider`)   |
| `POST /webhooks/domains` | Registrar callbacks (if any) |
| `POST /webhooks/hosting` | WHM/hooks or internal agents |

Handlers:

1. Verify signature
2. Persist `WebhookEvent` (idempotent)
3. Enqueue domain processing job
4. Return `202`/`200` quickly

---

## 8. WebSockets

Gateway namespace examples:

| Channel                | Who                  | Events                                                        |
| ---------------------- | -------------------- | ------------------------------------------------------------- |
| `/ws`                  | Authenticated        | connection + subscribe                                        |
| `org:{organizationId}` | Portal members       | `notification.created`, `ticket.message`, `project.updated`   |
| `user:{userId}`        | User                 | private notifications                                         |
| `admin:ops`            | Staff (permissioned) | ticket queue, AI approvals                                    |
| `ai:conversation:{id}` | Participants         | `ai.token`, `ai.tool`, `ai.approval_required`, `ai.completed` |

**Auth:** same session/JWT as HTTP; join rooms only after authorization.

**AI streaming:** prefer WS events for token stream; REST creates the run and returns `conversationId` / `runId`.

---

## 9. Background job triggers (API-adjacent)

HTTP endpoints may enqueue jobs rather than doing work inline:

| Trigger               | Queue               |
| --------------------- | ------------------- |
| Domain register       | `domains`           |
| Hosting provision     | `hosting`           |
| Invoice finalize/send | `billing` / `email` |
| KB publish            | `ai` (reindex)      |
| AI message            | `ai`                |
| Report export         | `reports`           |

Job payloads reference domain IDs only; workers load state from MariaDB.

---

## 10. OpenAPI & clients

- Nest decorators + OpenAPI plugin generate `openapi.json`.
- Portal/admin/website share a typed client (package or generated artifacts).
- Contract tests ensure DTO stability for portal ↔ API critical paths.

---

## 11. Rate limiting (high level)

| Class        | Policy                                |
| ------------ | ------------------------------------- |
| Public write | Strict (IP + fingerprint)             |
| Auth login   | Progressive backoff / lockout         |
| Portal AI    | Per-org daily quotas                  |
| Admin        | Higher, still bounded                 |
| Webhooks     | Signature required; large body limits |

Redis implements distributed rate limits.

---

## 12. Out of scope for this document

Exact field schemas for every DTO will be added as modules are implemented. This document freezes **surface area, audiences, and conventions** before production code.
