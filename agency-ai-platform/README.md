# Agency AI Platform

pnpm monorepo for the Agency AI platform.

| App / package        | Role                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| `apps/website`       | Public React/Vite website                                                            |
| `apps/client-portal` | Customer portal                                                                      |
| `apps/admin`         | Employee / admin console (`/admin/leads`, `/customers`, `/opportunities`, `/quotes`) |
| `apps/api`           | NestJS API                                                                           |
| `packages/ui`        | Shared UI                                                                            |
| `packages/database`  | Database layer                                                                       |
| `packages/auth`      | Authentication                                                                       |
| `packages/ai`        | AI integrations                                                                      |
| `packages/billing`   | Billing                                                                              |
| `packages/hosting`   | Hosting                                                                              |
| `packages/domains`   | Domains                                                                              |
| `packages/shared`    | Shared types & utils                                                                 |

## Start here

1. [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) — binding engineering, DB, security, AI, and workflow rules
2. [AGENTS.md](./AGENTS.md) — monorepo agent guide
3. [docs/README.md](./docs/README.md) — architecture contracts

## Local infrastructure (Docker Compose)

MariaDB and Redis run via Docker Compose for local development. Passwords come from environment variables — nothing secret is hard-coded in `docker-compose.yml`.

### 1. Prerequisites

- Docker Engine + Docker Compose plugin
- Node.js >= 22
- pnpm (`packageManager` pinned in root `package.json`)

### 2. Configure environment

```bash
cd agency-ai-platform
cp .env.example .env
```

Edit `.env` and set **local-only** values for:

- `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_ROOT_PASSWORD`
- `DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/agency_platform"` (same user/password)
- `REDIS_HOST` / `REDIS_PORT` (defaults: `localhost` / `6379`)
- Optional when needed: `JWT_SECRET`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

Keep `MYSQL_DATABASE=agency_platform`. Leave provider secrets empty until you configure those integrations.

Do **not** put production credentials in `.env`. `.env` is gitignored. Server secrets must never be prefixed with `VITE_`.

### 3. Start MariaDB + Redis

```bash
docker compose up -d
```

Check status and health:

```bash
docker compose ps
docker compose logs -f mariadb redis
```

MariaDB data persists in the Docker volume `agency_platform_mariadb_data`. Redis AOF data uses `agency_platform_redis_data`.

Stop (keep volumes):

```bash
docker compose down
```

Stop and remove volumes (destroys local DB data):

```bash
docker compose down -v
```

### 4. Connection defaults (after `.env` is filled)

| Service | Host port (default) | Notes                            |
| ------- | ------------------- | -------------------------------- |
| MariaDB | `MYSQL_PORT` (3306) | Database name: `agency_platform` |
| Redis   | `REDIS_PORT` (6379) | URL: `REDIS_URL`                 |

Apps should use `DATABASE_URL` and `REDIS_URL` from `.env` — never embed passwords in source.

## Database (Prisma + MariaDB)

Schema and migrations live in `packages/database` (`provider = "mysql"`, `DATABASE_URL`).

```bash
# with Docker MariaDB running and .env configured
pnpm db:validate
pnpm db:generate
pnpm db:migrate:deploy   # or pnpm db:migrate:dev while iterating
pnpm db:seed
```

Initial models: User, Session, Organization, OrganizationMember, Role, Permission, RolePermission, Customer, CustomerContact, AuditLog.

Commercial lifecycle: Lead → Opportunity → Quote → Customer → Project → Invoice → Recurring Services (`Subscription`), plus line/activity items.

Project delivery: Project → Milestone → Task → Subtask, plus Comment, Attachment, TimeEntry, ProjectMember, ProjectActivity.

Project pipeline: New → Planning → Design → Development → Customer Review → Revision → QA → Launch → Maintenance.

## Authentication

NestJS auth under `/api/v1/auth/*` with Argon2id passwords, HttpOnly `agency_session` cookies, RBAC guards, rate limiting, validation, and audit logs.

```bash
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev:api
pnpm dev:website   # register / login UI
```

Seeded users (local only): `admin@agency.local` (Super Admin) / `owner@acme.local` (Customer) — password `ChangeMeLocalOnly!`

Platform roles: Super Admin, Administrator, Manager, Sales, Developer, Designer, SEO Specialist, Hosting Technician, Support Agent, Billing, Customer.

## Application quick start

```bash
cd agency-ai-platform
pnpm install
pnpm docker:up          # optional alias — see package.json
pnpm dev:website        # http://localhost:5173
pnpm dev:api            # http://localhost:3000
```

Other apps: `pnpm dev:portal` (:5174), `pnpm dev:admin` (:5175).

Quality gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Application business features are still being built per [docs/ROADMAP.md](./docs/ROADMAP.md); docs define the contracts.
