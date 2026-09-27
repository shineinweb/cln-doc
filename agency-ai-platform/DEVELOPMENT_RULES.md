# PROJECT DEVELOPMENT RULES

This repository contains a production SaaS application.

**Always read this file before making architectural changes.**

Also read [AGENTS.md](./AGENTS.md) and the contracts under [docs/](./docs/).

---

## TECHNOLOGY

| Layer    | Stack                     |
| -------- | ------------------------- |
| Frontend | React + Vite + TypeScript |
| Backend  | NestJS + TypeScript       |
| Database | MariaDB + Prisma          |
| Cache    | Redis                     |
| Jobs     | BullMQ                    |

Related infrastructure (see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)): Nginx, Docker. AI via provider interfaces (OpenAI first). Billing via Stripe behind `PaymentProvider`. Hosting via cPanel/WHM behind `HostingProvider`.

---

## DEVELOPMENT RULES

1. Use TypeScript **strict** mode.
2. Do not use `any` unless absolutely necessary.
3. Do not duplicate business logic.
4. Keep controllers thin.
5. Business logic belongs in **services**.
6. Use **dependency injection**.
7. Use **provider interfaces** for external services.
8. Never hard-code credentials.
9. Never expose backend secrets to React applications.
10. All environment variables must be documented in `.env.example`.

---

## DATABASE

1. **MariaDB** is the primary database.
2. Do **NOT** introduce PostgreSQL.
3. All schema changes must use **Prisma migrations**.
4. Never manually modify the production database schema.
5. Use **transactions** for financial and critical operations.
6. Create appropriate **indexes** and **unique constraints**.

Details: [docs/DATABASE.md](./docs/DATABASE.md).

---

## SECURITY

1. Validate every API request.
2. Authentication does **not** equal authorization.
3. Every protected API must perform **authorization**.
4. Customer data must be **tenant isolated**.
5. Customer A must never access Customer B data.
6. Use secure **HTTP-only cookies** where appropriate.
7. Implement **rate limiting**.
8. Protect authentication endpoints.
9. Never log passwords, tokens, or API secrets.
10. Sensitive administrative actions require **audit logs**.

Details: [docs/SECURITY.md](./docs/SECURITY.md).

---

## AI

AI agents must never receive unrestricted system access.

Every AI tool must have:

- authentication
- authorization
- input validation
- tenant validation
- rate limiting where appropriate
- audit logging

AI **cannot** automatically:

- delete customer accounts
- delete hosting accounts
- delete databases
- change production DNS
- issue refunds
- deploy production code
- modify billing
- change permissions

These operations require **human approval**.

Details: [docs/AI_ARCHITECTURE.md](./docs/AI_ARCHITECTURE.md).

---

## WORKFLOW

Before implementing a feature:

1. Inspect existing code.
2. Read relevant documentation.
3. Explain implementation plan.
4. Identify database changes.
5. Identify API changes.
6. Identify security implications.
7. Implement.
8. Add tests.
9. Run lint.
10. Run typecheck.
11. Run tests.
12. Run build.
13. Fix errors.
14. Report what changed.

**Never ignore failing tests.**
