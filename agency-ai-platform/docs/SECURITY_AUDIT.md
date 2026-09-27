# Security Audit

**Date:** 2026-09-27  
**Scope:** `agency-ai-platform/` (Nest API, packages, React apps, Prisma schema, seed, Docker)  
**Method:** Static review of authentication, authorization, tenancy, providers, AI tools, webhooks, and dangerous sinks. No code changes were made for remediation in this pass.  
**Companion policy:** [SECURITY.md](./SECURITY.md)

**Maturity note:** Large surfaces are scaffold / PLACEHOLDER. Several findings are **latent** (unsafe once handlers are wired) rather than currently exploitable end-to-end. Severity reflects production impact if shipped as-is.

---

## Summary

| Severity      | Count |
| ------------- | ----- |
| Critical      | 0     |
| High          | 4     |
| Medium        | 10    |
| Low           | 5     |
| Informational | 8     |

**Highest priorities:** client-controlled AI `system` roles; default Stripe webhook secret; missing Nest raw body for Stripe signatures; staff MFA / lockout gap vs policy.

---

## Coverage matrix

| Category                       | Verdict                                             |
| ------------------------------ | --------------------------------------------------- |
| SQL injection                  | No findings (Prisma only)                           |
| XSS                            | No active sinks                                     |
| CSRF                           | Medium — SameSite only                              |
| Broken access control          | Low — solid globals; watch permission-less routes   |
| IDOR                           | Medium latent — pattern exists; most CRUD not built |
| Tenant data leakage            | Medium — optional org on RAG/vector types           |
| Authentication bypass          | High — MFA/lockout/verify gaps                      |
| Privilege escalation           | Low / Informational — register cannot self-staff    |
| Unsafe file uploads            | Informational — not implemented                     |
| Path traversal                 | Medium latent — coding tool `path` args             |
| SSRF                           | Medium latent — no live user-URL fetch              |
| Command injection              | Informational — no shell exec                       |
| Exposed secrets                | High — default webhook secret                       |
| Unsafe logging                 | Low                                                 |
| Webhook vulnerabilities        | High — rawBody + default secret                     |
| AI prompt injection            | High — client `system` / `tool` roles               |
| AI tool abuse                  | Medium — gates good; complete API unconstrained     |
| AI cross-customer data leakage | Medium latent — optional org on RAG/memory          |

---

## Findings

### SA-001 — Client-controlled AI system / tool messages (prompt injection)

| Field              | Value                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**       | High                                                                                                                                                           |
| **Category**       | AI prompt injection                                                                                                                                            |
| **Affected files** | `apps/api/src/ai/dto/complete.dto.ts`, `apps/api/src/ai/ai.controller.ts`, `packages/ai/src/ai-service.ts`, `packages/ai/src/providers/openai-llm-provider.ts` |

**Attack scenario:** An authenticated user with `ai.use` calls `POST /api/v1/ai/complete` with `role: "system"` (or `"tool"`) messages. Those messages are validated as allowed roles and passed unchanged to the LLM provider. Once the OpenAI transport is live, the attacker can override server safety instructions, coerce tool-like behavior, or jailbreak policies that were meant to be server-owned.

**Recommended remediation:**

1. Restrict client message roles to `user` and `assistant` only (reject `system` / `tool` from the client).
2. Inject a server-owned system prompt in Nest/`AiService` after authz.
3. Treat ticket text and RAG chunks as untrusted data in that system prompt.
4. Call `assertAiEnabled` and `clampMaxTokens` on every completion path.

---

### SA-002 — Default Stripe webhook secret `"whsec_unwired"`

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Severity**       | High                                      |
| **Category**       | Exposed secrets / webhook vulnerabilities |
| **Affected files** | `apps/api/src/billing/billing.module.ts`  |

**Attack scenario:** If the API boots without `STRIPE_WEBHOOK_SECRET`, verification uses the well-known fallback `whsec_unwired`. An attacker who knows that default can forge `Stripe-Signature` headers and post fake events to `POST /api/v1/webhooks/stripe`. Blast radius is limited while handlers are PLACEHOLDER, but becomes Critical once invoice/subscription state is applied.

**Recommended remediation:**

1. Fail fast in production (and preferably all envs) when `STRIPE_WEBHOOK_SECRET` is missing or equals a known placeholder.
2. Never default webhook secrets to a constant string.
3. Keep signature verification before any persistence or job enqueue.

---

### SA-003 — Stripe webhook raw body not preserved (signature bypass / breakage)

| Field              | Value                                                                       |
| ------------------ | --------------------------------------------------------------------------- |
| **Severity**       | High                                                                        |
| **Category**       | Webhook vulnerabilities                                                     |
| **Affected files** | `apps/api/src/main.ts`, `apps/api/src/billing/stripe-webhook.controller.ts` |

**Attack scenario:** Nest is created without `rawBody: true`. The controller falls back to `JSON.stringify(request.body)` when `rawBody` is absent. Re-serialization changes whitespace/key order relative to Stripe’s signed payload, so legitimate webhooks fail — and, combined with a weak/default secret (SA-002), forged bodies that match the re-serialized form can be accepted. Side effects are PLACEHOLDER today.

**Recommended remediation:**

1. Enable raw body capture for `/api/v1/webhooks/stripe` only.
2. Reject requests when raw bytes are missing (remove the `JSON.stringify` production fallback).
3. Keep unit tests supplying explicit `rawBody` strings.

---

### SA-004 — Staff MFA and account lockout not implemented

| Field              | Value                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **Severity**       | High                                                                                            |
| **Category**       | Authentication bypass                                                                           |
| **Affected files** | `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`, `docs/SECURITY.md` |

**Attack scenario:** Policy requires MFA for staff in production and lockouts against credential stuffing. Login only verifies Argon2id password and issues a 14-day session. Throttling exists (`@Throttle`) but there is no progressive lockout, TOTP enrollment, or MFA challenge. Stolen or guessed staff passwords yield full RBAC permissions for the assigned roles.

**Recommended remediation:**

1. Require TOTP (or equivalent) for `isStaff` users before issuing a session in production.
2. Store MFA secrets encrypted; hash recovery codes.
3. Add failed-attempt counters and temporary lockouts with audit events.
4. Optionally step-up MFA for `billing.refund`, `roles.manage`, and AI approvals.

---

### SA-005 — CSRF: cookie sessions without Origin checks or CSRF tokens

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                                         |
| **Category**       | CSRF                                                                                           |
| **Affected files** | `packages/auth/src/cookies.ts`, `apps/api/src/auth/auth.controller.ts`, `apps/api/src/main.ts` |

**Attack scenario:** Session cookies use `HttpOnly` + `SameSite=Lax`. Modern browsers block most cross-site POSTs with cookies, but there is no double-submit CSRF token and no Origin/Referer allowlist on mutating cookie-authenticated routes, contrary to `docs/SECURITY.md` §3.2. Mis-set cookies, older clients, or future `SameSite=None` changes would widen CSRF risk for refunds, AI, and admin actions.

**Recommended remediation:**

1. Enforce Origin/Referer allowlist on all cookie-authenticated state-changing requests.
2. Add double-submit CSRF tokens for defense in depth.
3. Keep `SameSite=Lax` (or `Strict` where viable) and `Secure` outside local dev.

---

### SA-006 — Sessions issued without email verification

| Field              | Value                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                     |
| **Category**       | Authentication bypass                                                      |
| **Affected files** | `apps/api/src/auth/auth.service.ts` (`register`, `login`, `buildUserView`) |

**Attack scenario:** Registration creates a session immediately and returns the session cookie before email verification. Login does not require `emailVerifiedAt`. An attacker can register with a victim’s email (if unused) or use an unverified account to call authenticated APIs (`ai.use`, portal org routes) until verification is enforced elsewhere.

**Recommended remediation:**

1. Soft-limit unverified accounts (read-only / no AI / no billing) or block session until verified.
2. Require verified email for privileged portal actions.
3. Keep forgot-password’s non-enumerating response behavior.

---

### SA-007 — Optional `organizationId` on RAG / vector search (tenant leakage)

| Field              | Value                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                                                                                                                                |
| **Category**       | Tenant data leakage / AI cross-customer data leakage                                                                                                                                  |
| **Affected files** | `packages/ai/src/providers/vector-store.ts`, `packages/ai/src/knowledge/rag.ts`, `packages/database/prisma/schema.prisma` (`KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeArticle`) |

**Attack scenario:** When VectorStore/RAG handlers are wired, a search with omitted `organizationId` (or a global article collection without visibility filters) can retrieve another customer’s private chunks into prompts or completions. Tool-level membership checks do not protect retrieval if the store query is unscoped.

**Recommended remediation:**

1. Make `organizationId` required on private upsert/search paths.
2. Explicitly separate `visibility=public|internal` global KB from tenant-private documents.
3. Add automated cross-tenant negative tests on every retrieval API.
4. Never default search to “all organizations.”

---

### SA-008 — Unconstrained `POST /ai/complete` (AI tool / cost abuse)

| Field              | Value                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                                                     |
| **Category**       | AI tool abuse                                                                                              |
| **Affected files** | `apps/api/src/ai/ai.controller.ts`, `apps/api/src/ai/dto/complete.dto.ts`, `packages/ai/src/ai-service.ts` |

**Attack scenario:** The completion endpoint requires `ai.use` but does not bind organization, agent allowlists, tool registry, or approval gates. `model` is a free string; `maxTokens` / `temperature` lack upper bounds in the DTO; `AiService` does not apply `DEFAULT_AI_SECURITY_POLICY`. A caller can drive expensive models/tokens or bypass the Supervisor → specialist → tool pipeline once the transport is live.

**Recommended remediation:**

1. Route customer/staff AI through Supervisor agents with allowlisted tools.
2. Bind completions to `organizationId` + conversation/run records.
3. Cap `maxTokens` / temperature; allowlist models; enforce per-org budgets.
4. Wire kill switch via `assertAiEnabled`.

---

### SA-009 — Write AI tools without approval flags

| Field              | Value                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Severity**       | Medium                                                                                                                                                                               |
| **Category**       | AI tool abuse                                                                                                                                                                        |
| **Affected files** | `packages/ai/src/tools/knowledge-tools.ts`, `packages/ai/src/tools/customer-support-tools.ts`, `packages/ai/src/tools/coding-tools.ts`, `packages/ai/src/tools/authorized-invoke.ts` |

**Attack scenario:** `invokeAuthorizedTool` correctly blocks tools with `requiresApproval` or destructive risk until approved. Several write tools ship with `requiresApproval: false` (e.g. `updateKnowledgeEmbeddings`, `createTicket`, `generateCode`, `runTests`). When handlers are bound, prompt injection or a compromised session could mutate KB indexes, open tickets, or generate/run code without human review.

**Recommended remediation:**

1. Default write/index/deploy-adjacent tools to `requiresApproval: true` unless explicitly customer self-service.
2. Validate tool parameters (schemas are currently hints only).
3. Keep hard deny for production filesystem mutation (`forbidden-paths.ts`).

---

### SA-010 — Coding tool filesystem `path` arguments (path traversal — latent)

| Field              | Value                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                                 |
| **Category**       | Path traversal                                                                         |
| **Affected files** | `packages/ai/src/tools/coding-tools.ts`, `packages/ai/src/security/forbidden-paths.ts` |

**Attack scenario:** Tools such as `readRepository`, `searchCode`, and `explainCode` accept caller/LLM-supplied `path` values. Handlers are PLACEHOLDER today. When bound to a real repo filesystem, unsanitized `../` paths could read host files outside the project root (credentials, env files, other customers’ workspaces).

**Recommended remediation:**

1. Resolve paths under a configured repo root; reject if not a prefix of the root.
2. Deny symlinks escaping the root; deny absolute paths from the model.
3. Never map coding tools onto production server filesystems (keep PR-based delivery).

---

### SA-011 — Future URL-driven fetches (SSRF — latent)

| Field              | Value                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**       | Medium                                                                                                                                        |
| **Category**       | SSRF                                                                                                                                          |
| **Affected files** | `packages/database/prisma/schema.prisma` (`KnowledgeDocument.sourceUrl`), `packages/hosting/src/cpanel-whm-provider.ts`, hosting/DNS AI tools |

**Attack scenario:** No application code currently fetches attacker-controlled URLs. Schema and provider designs anticipate `sourceUrl` ingestion and hosting/DNS diagnostics. Without allowlists, a future “fetch URL” or webhook-callback feature could hit link-local/metadata endpoints (cloud IMDS) or internal admin services.

**Recommended remediation:**

1. Allowlist schemes (`https`) and destinations; block private/link-local/metadata IP ranges.
2. Do not expose open-fetch AI tools to customers.
3. Keep WHM/`baseUrl` as operator config, not end-user input.

---

### SA-012 — Missing security headers and env-driven CORS

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Severity**       | Medium                                       |
| **Category**       | Broken access control / XSS defense-in-depth |
| **Affected files** | `apps/api/src/main.ts`                       |

**Attack scenario:** API bootstrap enables CORS only for localhost Vite ports and does not install Helmet-equivalent headers (CSP, HSTS, `X-Frame-Options`, etc.) required by `docs/SECURITY.md` §10. A production deploy that loosens CORS incorrectly (e.g. `origin: true` with `credentials: true`) would enable cross-origin credentialed API abuse from arbitrary sites.

**Recommended remediation:**

1. Drive CORS origins from environment configuration.
2. Add Helmet (or equivalent) with strict defaults.
3. Never combine `credentials: true` with wildcard origins.

---

### SA-013 — Portal demo session is client-only privilege fiction

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Severity**       | Medium                                        |
| **Category**       | Authentication bypass / broken access control |
| **Affected files** | `apps/client-portal/src/auth/AuthContext.tsx` |

**Attack scenario:** The portal can enter a local `DEMO_USER` via `sessionStorage` without calling the API. API routes still require real session cookies, so this is not a server bypass today. Risk rises if future UI code treats demo state as authorization, or if demo credentials are confused with real staff identity in screenshots/support flows.

**Recommended remediation:**

1. Clearly mark demo mode as non-authoritative in UI and never send demo tokens to the API.
2. Prefer API-backed demo tenants in non-production environments.
3. Ensure admin/portal never trust client `isStaff` / permissions fields.

---

### SA-014 — IDOR risk on future tenant CRUD (latent)

| Field              | Value                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Severity**       | Medium                                                                                                                                           |
| **Category**       | IDOR / broken access control                                                                                                                     |
| **Affected files** | `packages/auth/src/tenant.ts`, `apps/api/src/portal/portal-organizations.controller.ts`, Prisma tenant models (invoices, tickets, hosting, etc.) |

**Attack scenario:** The only portal resource API (`GET /portal/organizations/:organizationId`) correctly calls `assertOrganizationAccess` and returns 404 on cross-tenant access. Most customer-owned tables have no HTTP surface yet. When invoice/ticket/hosting APIs are added, omitting membership checks would allow Customer A to read/modify Customer B by guessing IDs.

**Recommended remediation:**

1. Mandate `assertOrganizationAccess` (or equivalent query filter) on every portal handler.
2. Prefer opaque IDs + membership join filters in Prisma.
3. Extend `test:tenant-isolation` for each new resource.

---

### SA-015 — Permission-less authenticated routes rely on omission

| Field              | Value                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| **Severity**       | Low                                                                             |
| **Category**       | Broken access control                                                           |
| **Affected files** | `apps/api/src/common/guards/permissions.guard.ts`, `apps/api/src/app.module.ts` |

**Attack scenario:** `PermissionsGuard` allows the request when no `@Permissions()` metadata is set. Any authenticated user can reach such routes. Current surface is small (`/auth/me`, portal org GET). A future admin controller that forgets `@Permissions` + `StaffGuard` would be reachable by any logged-in customer session.

**Recommended remediation:**

1. Keep `StaffGuard` at admin controller class level.
2. Consider a default-deny policy for `/admin/*` (require explicit permissions).
3. Lint/test that new admin routes declare permissions.

---

### SA-016 — Weak password policy (length only)

| Field              | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| **Severity**       | Low                                                                  |
| **Category**       | Privilege escalation / authentication                                |
| **Affected files** | `packages/auth/src/password.ts`, `apps/api/src/auth/auth.service.ts` |

**Attack scenario:** Passwords need only 10–128 characters. No complexity, breach-list, or reuse checks. Combined with missing lockout (SA-004), weak staff passwords are easier to guess.

**Recommended remediation:**

1. Add complexity and/or breached-password checks.
2. Encourage/require password managers; enforce MFA for staff (SA-004).

---

### SA-017 — Full exception objects logged on 500s

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Severity**       | Low                                                                                            |
| **Category**       | Unsafe logging                                                                                 |
| **Affected files** | `apps/api/src/common/filters/problem-details.filter.ts`, `packages/auth/src/email-provider.ts` |

**Attack scenario:** Unexpected errors are `console.error(exception)`’d. If a future code path embeds tokens, provider payloads, or raw webhook bodies in Error objects, they land in log sinks. Client responses correctly hide 500 internals. Email provider logs recipient + subject only (acceptable).

**Recommended remediation:**

1. Log redacted error codes/stacks; never log passwords, session tokens, Stripe signatures, or raw provider secrets.
2. Add structured logging with explicit deny-lists for sensitive fields.

---

### SA-018 — Registration email enumeration

| Field              | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| **Severity**       | Low                                                                    |
| **Category**       | Authentication                                                         |
| **Affected files** | `apps/api/src/auth/auth.service.ts` (`register` → `ConflictException`) |

**Attack scenario:** Registering an existing email returns a conflict error, allowing attackers to probe which emails have accounts. Login and forgot-password responses are appropriately generic.

**Recommended remediation:**

1. Return a generic success for register (send “already registered” email) or rate-limit heavily and monitor.
2. Keep login/forgot-password non-enumerating behavior.

---

### SA-019 — Long-lived sessions without rotation on privilege change

| Field              | Value                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| **Severity**       | Low                                                                        |
| **Category**       | Authentication bypass                                                      |
| **Affected files** | `apps/api/src/auth/auth.constants.ts`, `apps/api/src/auth/auth.service.ts` |

**Attack scenario:** Sessions last 14 days (`SESSION_TTL_MS`). Password reset deletes sessions (good). Role/permission changes or staff demotion do not yet invalidate existing sessions, so a stolen cookie may retain elevated access until expiry.

**Recommended remediation:**

1. Invalidate sessions on role/permission changes and staff disable.
2. Consider idle timeout and periodic session rotation.
3. Bind sessions to user `isActive` (already checked on resolve).

---

### SA-020 — SQL injection

| Field              | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Severity**       | Informational                                               |
| **Category**       | SQL injection                                               |
| **Affected files** | `apps/api/src/auth/auth.service.ts`, `packages/database/**` |

**Attack scenario:** None identified. No `$queryRaw` / `$executeRaw` / `queryRawUnsafe` / string-concatenated SQL was found. Access uses Prisma parameterized APIs.

**Recommended remediation:** Continue forbidding raw SQL with user input; if analytics SQL is needed, use tagged template `$queryRaw` with bound parameters only.

---

### SA-021 — XSS

| Field              | Value                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| **Severity**       | Informational                                                                     |
| **Category**       | XSS                                                                               |
| **Affected files** | React apps under `apps/*/src` (e.g. `apps/client-portal/src/pages/AskAiPage.tsx`) |

**Attack scenario:** None identified. No `dangerouslySetInnerHTML` or equivalent unsanitized HTML sinks found. User/AI text is rendered via React text nodes (escaped by default). CMS HTML rendering is documented but not implemented.

**Recommended remediation:** Sanitize any future CMS/HTML fields; keep CSP when Helmet is added (SA-012).

---

### SA-022 — Unsafe file uploads

| Field              | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| **Severity**       | Informational                                                                 |
| **Category**       | Unsafe file uploads                                                           |
| **Affected files** | `packages/database/prisma/schema.prisma` (`KnowledgeDocument` storage fields) |

**Attack scenario:** No upload endpoints or multer/`StorageProvider` handlers exist yet. Schema anticipates `storageKey`, `mimeType`, `sizeBytes`, `sourceUrl`.

**Recommended remediation:** When implementing uploads: MIME/size allowlists, private buckets, signed URLs, virus-scan jobs, no user-controlled storage paths.

---

### SA-023 — Command injection

| Field              | Value                                                            |
| ------------------ | ---------------------------------------------------------------- |
| **Severity**       | Informational                                                    |
| **Category**       | Command injection                                                |
| **Affected files** | `packages/ai/src/tools/coding-tools.ts` (`runTests` PLACEHOLDER) |

**Attack scenario:** None today — no `child_process` / `exec` / `spawn` usage in application code. Future `runTests` must not concatenate shell strings from model output.

**Recommended remediation:** Use argv arrays, sandboxes, and fixed test runners; never `shell: true` with model input.

---

### SA-024 — Secrets in git / local seed passwords

| Field              | Value                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Severity**       | Informational (local seed) / note                                                                             |
| **Category**       | Exposed secrets                                                                                               |
| **Affected files** | `.gitignore`, `.env.example`, `packages/database/prisma/seed.ts`, local `packages/database/.env` (gitignored) |

**Attack scenario:** Tracked env files are examples only; `.env` is gitignored. Seed uses password `ChangeMeLocalOnly!` for local demo users. Risk is operational: seeding that password into shared/staging DBs would create known credentials.

**Recommended remediation:**

1. Block seed of default passwords outside `NODE_ENV=development`.
2. Rotate any environment that ever received seed credentials.
3. Keep requiring secrets via env/secret manager in production (`OPENAI_API_KEY`, Stripe keys, `JWT_SECRET`).

---

### SA-025 — Privilege escalation via public registration

| Field              | Value                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Severity**       | Informational (positive control)                                                                               |
| **Category**       | Privilege escalation                                                                                           |
| **Affected files** | `apps/api/src/auth/auth.service.ts`, `packages/auth/src/roles.ts`, `apps/api/src/common/guards/staff.guard.ts` |

**Attack scenario:** Public registration hardcodes `isStaff: false` and does not attach staff `UserRole` rows. Customers receive catalog `customer` permissions (`ai.use`) plus portal membership permissions. Admin routes require `StaffGuard`. No role-assignment HTTP API exists yet.

**Recommended remediation:** When building `/admin/employees` or role APIs, require `roles.manage`, prevent self-elevation, and audit every change. Never trust client-supplied `isStaff` / permissions.

---

### SA-026 — Controls confirmed working (baseline)

| Field              | Value                       |
| ------------------ | --------------------------- |
| **Severity**       | Informational               |
| **Category**       | Defense-in-depth (positive) |
| **Affected files** | See table below             |

These controls were reviewed and are correctly oriented for production hardening. Preserve and extend them; do not weaken tests.

| Control                                                      | Location                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Argon2id password hashing                                    | `packages/auth/src/password.ts`                                                                      |
| Opaque session tokens hashed at rest (SHA-256)               | `packages/auth/src/tokens.ts`, `apps/api/src/auth/auth.service.ts`                                   |
| HttpOnly session cookies + `Secure` in production            | `packages/auth/src/cookies.ts`, `auth.controller.ts`                                                 |
| Global `AuthGuard` / `PermissionsGuard` / `ThrottlerGuard`   | `apps/api/src/app.module.ts`                                                                         |
| Staff isolation (`StaffGuard`, `assertStaff`)                | `apps/api/src/common/guards/staff.guard.ts`                                                          |
| Tenant isolation helper + portal 404 on cross-tenant         | `packages/auth/src/tenant.ts`, portal organizations controller                                       |
| Refund permission gate (guard + service)                     | `packages/billing/src/refund-authorization.ts`, refunds controller/service                           |
| Stripe HMAC + timestamp skew + `timingSafeEqual`             | `packages/billing/src/stripe-webhook.ts`                                                             |
| AI actor authz (no impersonation / cross-tenant tool invoke) | `packages/ai/src/security/authorization.ts`                                                          |
| AI approval gate for high-risk tools                         | `packages/ai/src/tools/authorized-invoke.ts`                                                         |
| Forbidden AI → production file mutation                      | `packages/ai/src/security/forbidden-paths.ts`                                                        |
| ValidationPipe whitelist / forbid non-whitelisted            | `apps/api/src/main.ts`                                                                               |
| Password reset invalidates sessions                          | `apps/api/src/auth/auth.service.ts`                                                                  |
| Auth event audit logging                                     | `apps/api/src/audit/audit.service.ts`                                                                |
| Security regression suites                                   | `apps/api/src/security.integration.test.ts`, `pnpm test:authorization`, `pnpm test:tenant-isolation` |

---

## Recommended remediation order

1. **SA-001** — Forbid client `system`/`tool` roles; server-owned system prompt; wire AI policy clamps.
2. **SA-002 / SA-003** — Require real Stripe webhook secret; enable raw body; remove JSON fallback.
3. **SA-004 / SA-006** — Staff MFA + lockouts; constrain unverified sessions.
4. **SA-007 / SA-008 / SA-009** — Mandatory tenant scoping for RAG; constrain complete API; tighten tool approval defaults.
5. **SA-005 / SA-012** — CSRF Origin checks; Helmet; env-driven CORS.
6. **SA-010 / SA-011 / SA-022 / SA-023** — Sandbox paths, URL allowlists, upload controls, and safe process execution before enabling those PLACEHOLDER handlers.

---

## Out of scope / not exercised

- Dynamic penetration testing against a running staging deployment
- Dependency CVE scanning (recommend enabling in CI per `docs/SECURITY.md` §12)
- Production secret-manager configuration review
- Formal threat model workshops beyond this static pass

---

_End of audit. No remediation patches were applied in this document-only pass._
