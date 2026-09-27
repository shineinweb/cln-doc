# Security Architecture

Security model for authentication, authorization, tenancy, secrets, providers, AI actions, and audit. Applies to all apps and workers.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md), [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

## 1. Goals

1. Protect customer data with strong isolation between organizations.
2. Enforce least-privilege RBAC for staff.
3. Keep secrets and provider credentials out of apps and git.
4. Make sensitive AI/tool actions **approvable and auditable**.
5. Assume breach: encrypt sensitive fields, hash credentials, short-lived sessions.

---

## 2. Threat model (summary)

| Threat                        | Mitigations                                                              |
| ----------------------------- | ------------------------------------------------------------------------ |
| Credential stuffing           | Rate limits, MFA, lockouts, breach-resistant password hashing (Argon2id) |
| Session theft                 | HttpOnly Secure cookies, rotation, device binding optional               |
| IDOR / cross-tenant access    | Mandatory `organizationId` scoping + automated tests                     |
| Privilege escalation          | Permission checks on every admin route; no role trust in client          |
| Webhook forgery               | Signature verification, idempotency store                                |
| Prompt injection → tool abuse | Tool allowlists, human approval, sandboxed side effects                  |
| Secret leakage                | Env/secret manager; never log tokens/PAN/raw provider secrets            |
| File malware                  | Type/size limits, virus scan job (planned), signed URLs                  |

---

## 3. Authentication

### 3.1 Actors

| Actor             | Auth                                                   |
| ----------------- | ------------------------------------------------------ |
| Customer user     | Email/password (+ optional MFA)                        |
| Staff user        | Email/password + **MFA required** in production        |
| Provider webhooks | Signature secrets                                      |
| Workers           | No public auth; private network + job tokens if needed |

### 3.2 Session strategy (preferred)

- Server-side session or rotating refresh tokens.
- Access token: short-lived JWT **or** opaque session id in HttpOnly cookie.
- Cookie flags: `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict` where viable).
- CSRF: double-submit or SameSite + origin checks for cookie sessions.

### 3.3 Passwords & MFA

- Argon2id (or bcrypt if Argon2 unavailable) with unique salt.
- MFA: TOTP; recovery codes hashed at rest.
- Password reset tokens single-use, short TTL, audited.

### 3.4 Registration

Public registration creates a customer `User`, `Organization`, and owner membership. Staff users are **invited** from admin only (no public staff signup).

---

## 4. Authorization (RBAC)

### 4.1 Permission model

Permissions are string capabilities. Canonical catalog (`@agency/auth` `PLATFORM_PERMISSIONS`):

```text
customers.view | customers.create | customers.edit | customers.delete
projects.view | projects.create | projects.edit
hosting.view | hosting.create | hosting.suspend
domains.view | domains.manage
billing.view | billing.refund
ai.use | ai.manage | ai.approve
users.manage | roles.manage
```

Roles bundle these permissions (`PLATFORM_ROLES`):  
`super_admin`, `administrator`, `manager`, `sales`, `developer`, `designer`, `seo_specialist`, `hosting_technician`, `support_agent`, `billing`, `customer`.

### 4.2 Portal vs admin

| Context | Mechanism                                                       |
| ------- | --------------------------------------------------------------- |
| Portal  | `OrganizationMember.role` → limited permission set (`portal.*`) |
| Admin   | `UserRole` → `Role` → `Permission`                              |

A staff user accessing portal-impersonation (if ever enabled) requires explicit `support.impersonate` and full audit.

### 4.3 Enforcement points

1. Nest guards on controllers (`AuthGuard`, `PermissionsGuard`, `StaffGuard` on `/admin`)
2. Service-layer assertions for defense in depth (`assertOrganizationAccess`, `authorizeRefundIssuance`, `invokeAuthorizedTool`)
3. Prisma queries always filter by tenant where applicable
4. UI hides controls **but never authorizes**
5. Stripe webhooks: HMAC signature verification before any side effects (`StripePaymentProvider.parseWebhook`)
6. Automated suites: `pnpm test:authorization`, `pnpm test:tenant-isolation`, `pnpm test:integration`

### 4.4 Object-level checks

Examples:

- Portal user may only read invoices where `invoice.organizationId ∈ user.memberships`
- Staff need `billing.view` **and** (global scope or assigned account policy)

---

## 5. Tenancy isolation

1. Every customer-owned row has `organizationId`.
2. Portal request context binds a single active organization.
3. Integration tests include cross-tenant negative cases.
4. AI memory and RAG chunks are scoped; global KB is marked `visibility=public|internal` and never leaks other orgs’ private data into customer prompts.

---

## 6. Data protection

| Class                   | Handling                                       |
| ----------------------- | ---------------------------------------------- |
| Passwords / MFA secrets | Hash / encrypt; never log                      |
| Payment data            | Tokenized via Stripe; no PAN/CVID in MariaDB   |
| File contents           | Object storage; DB stores keys + checksums     |
| Provider tokens         | Secret manager; encrypted at rest if stored    |
| PII                     | Minimize; retention policies; erasure workflow |
| Backups                 | Encrypted; access-controlled                   |

**Encryption at rest:** disk-level for MariaDB/Redis/volumes; field-level encryption for MFA secrets and similar.

**TLS everywhere** externally; internal mTLS optional in hardened deployments.

---

## 7. Provider security

| Provider         | Controls                                                             |
| ---------------- | -------------------------------------------------------------------- |
| Stripe           | Webhook signing secret; restricted API keys; test vs live separation |
| OpenAI           | Server-side keys only; per-org budget caps; content logging policy   |
| WHM/cPanel       | IP allowlist if possible; least-privilege API tokens; action audit   |
| Domain registrar | API keys in secrets; confirm emails for transfers                    |
| Email            | Domain auth (SPF/DKIM/DMARC); template injection safety              |
| Storage          | Private buckets; short-lived signed URLs                             |

All calls go through provider interfaces; adapters centralize credential usage.

---

## 8. AI security controls

1. **Tool allowlists** per agent role.
2. **Human approval** for high-risk tools (billing refunds, hosting suspend, DNS deletes, domain transfer).
3. **Prompt injection hardening:** treat retrieved docs and ticket text as untrusted data; separate system instructions from untrusted content.
4. **Output filtering** for secrets patterns before showing to customers.
5. **Quota & cost guards** per organization and per agent.
6. **Full AI audit trail** (`AiRun`, `AiToolCall`, `AiApproval`, `AiAuditEvent`).

Details: [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md).

---

## 9. Audit logging

### 9.1 What must be audited

- Login success/failure, MFA changes, password changes
- Role/permission changes
- Quote/contract send & sign
- Invoice create, pay, refund
- Domain register/transfer, DNS changes
- Hosting create/suspend/unsuspend/terminate
- Ticket access to sensitive attachments (optional)
- AI approvals (approve/deny) and high-risk tool execution
- System settings changes

### 9.2 Properties

- Append-only (`AuditLog`)
- Includes actor, action, entity, before/after (redacted), IP, user agent, request id
- Retained per compliance policy; exportable for reports
- Admins with `roles.manage` / privileged staff only for audit access; no update/delete API

---

## 10. Application security practices

| Practice         | Requirement                                                    |
| ---------------- | -------------------------------------------------------------- |
| Input validation | Zod/class-validator on all mutating endpoints                  |
| Output encoding  | React default escaping; sanitize CMS HTML                      |
| CORS             | Explicit allowlist of website/portal/admin origins             |
| Headers          | Helmet-equivalent: CSP, HSTS, frame deny                       |
| Dependencies     | Lockfile + automated CVE scanning                              |
| File uploads     | Size/MIME allowlist; storage via `StorageProvider`             |
| SSRF             | Providers validate URLs; no open fetch tools without allowlist |

---

## 11. Secrets & configuration

- `.env` local only; `.env.example` committed with placeholders
- Production: secret manager / host env injection
- Rotate Stripe/OpenAI/WHM keys without code changes (provider config)
- Separate secrets per environment

---

## 12. Secure SDLC

1. PR review for authZ and provider boundary changes
2. CI: lint, typecheck, unit tests, dependency scan
3. Staging soak before production migrate
4. Incident runbooks: key rotation, session revoke, org lockdown

---

## 13. Compliance posture (directional)

The platform should be design-ready for:

- GDPR-style data subject access & erasure (jobs, not manual SQL)
- Clear data processing records for AI (what was sent to LLM providers)
- PCI scope minimization via Stripe (SAQ A oriented)

Formal certifications are out of scope for architecture docs but constraints above keep the path open.
