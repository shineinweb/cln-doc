# Agency AI Platform

pnpm monorepo for the Agency AI platform.

| App / package        | Role                      |
| -------------------- | ------------------------- |
| `apps/website`       | Public React/Vite website |
| `apps/client-portal` | Customer portal           |
| `apps/admin`         | Employee / admin console  |
| `apps/api`           | NestJS API                |
| `packages/ui`        | Shared UI                 |
| `packages/database`  | Database layer            |
| `packages/auth`      | Authentication            |
| `packages/ai`        | AI integrations           |
| `packages/billing`   | Billing                   |
| `packages/hosting`   | Hosting                   |
| `packages/domains`   | Domains                   |
| `packages/shared`    | Shared types & utils      |

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

- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`

Keep `MYSQL_DATABASE=agency_platform`. Update `DATABASE_URL` so the password matches `MYSQL_PASSWORD`.

Do **not** put production credentials in `.env`. `.env` is gitignored.

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
