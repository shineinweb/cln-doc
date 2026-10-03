# Trim

Trim is a multi-site cannabis cultivation workspace. Phase 1 covers the monorepo, local infrastructure, the organization → site → room → zone model, email/password sign-in, and site access checks. The room dashboard is the navigation center; this phase shows real facilities and rooms and leaves later modules as placeholders.

The product lives in this `trim/` directory.

## Prerequisites

- Node.js 22 or newer
- pnpm 10 (`corepack enable` then `corepack prepare pnpm@10.33.3 --activate`)
- Docker with Compose v2

## Start the stack

From `trim/`:

```bash
cp .env.example .env
docker compose up -d
./infra/wait-for-mysql.sh
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:prepare
```

Then start the three processes, each in its own terminal (still inside `trim/`):

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

`pnpm dev` prepares packages and starts all three together if you prefer one command.

### URLs

| Service | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000 |
| Health | http://localhost:3000/health |
| S3 API (RustFS) | http://localhost:9000 |
| S3 console | http://localhost:9001 |
| MySQL | `127.0.0.1:3306` database `trim`, user `trim`, password `trim` |
| Redis | `redis://127.0.0.1:6379` |

The web app calls `/api/...` on port 5173. Vite proxies that to the API and strips the `/api` prefix. API routes themselves have no global prefix (`POST /auth/login`, `GET /sites`).

S3 console login is `trim` / `trimsecret`. Phase 1 does not upload files; the API only constructs an S3 client from the env vars. Official MinIO images could not be pulled when this phase was built (Docker Hub removed `minio/minio`, and anonymous Quay pulls return unauthorized), so Compose runs [RustFS](https://github.com/rustfs/rustfs) 1.0.0, which serves the S3 API on port 9000. Create the dev bucket after the S3 service is up:

```bash
pnpm storage:bucket
```

## Seeded dev logins

These accounts exist only after `pnpm db:seed`. They belong to **Harbor & Hill Cultivation**. Passwords are development fixtures.

| Person | Email | Password | Access |
| --- | --- | --- | --- |
| Avery Chen | `avery.chen@harborhill.example` | `HarborHill-admin` | Organization admin. Sees Harbor House and Hill Works. No site membership rows. |
| Blake Ortiz | `blake.ortiz@harborhill.example` | `HarborHouse-only` | Harbor House only |
| Casey Nguyen | `casey.nguyen@harborhill.example` | `HillWorks-only` | Hill Works only |

Harbor House (Astoria) has Flower 1 and Dry Room. Hill Works (Hood River) has Veg 1 and Mother Room. A producer license row (`OR-CULT-44821`) is stored and linked to both sites. The API does not expose licenses in this phase.

## Authentication

Sign-in returns a bearer JWT. The browser stores it in `sessionStorage`. Each request reloads roles and site memberships from MySQL, so the token does not grant site access by itself. Details: [docs/authentication.md](docs/authentication.md). The tables are described in [docs/data-model.md](docs/data-model.md).

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test` migrates the separate `trim_test` database, then proves:

- requests without a token are rejected (`401`)
- the Site A user cannot read Site B, its rooms, or a Site B room (`403`)
- the Site B user cannot read Site A (`403`)
- the Site A list contains only Site A, and the Site B list contains only Site B
- the organization admin can read both sites and their rooms
- a site in another organization is hidden (`404`) and does not appear in the admin list

The access tests create their own users. They do not depend on the seed passwords above.

To migrate the test database yourself:

```bash
DATABASE_URL=mysql://trim:trim@127.0.0.1:3306/trim_test pnpm db:migrate
```

`dotenv` does not override a `DATABASE_URL` already set in the shell.

## Phase 1 boundaries

Not built: crop-cycle workflow, plant tracking, Metrc calls, harvest, environmental charts, analytics, device adapters, email/SMS, attachment uploads, and BullMQ business jobs. The worker only connects to Redis and opens the `trim.infrastructure` queue.
