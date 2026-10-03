# Trim

Trim is a multi-site cannabis cultivation workspace. Phase 1 covers access and the organization → site → room → zone model. Phase 2 adds crop cycles and the room dashboard. Phase 3 adds versioned workflow templates, generated assignments, and the employee workspace. Phase 4 tracks plants by license and compares a saved inventory file.

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

Harbor House (Astoria) has Flower 1 and Dry Room. Hill Works (Hood River) has Veg 1 and Mother Room. Each facility has its own producer license: Harbor House `OR-CULT-44821`, Hill Works `OR-CULT-55218`. A person who can open a site can read that site’s license inventory. Avery can read both.

Active cycles, both in `America/Los_Angeles`:

| Room | Cycle | Cultivar | Plants | Stage | Start | Expected harvest |
| --- | --- | --- | --- | --- | --- | --- |
| Harbor House · Flower 1 | Cedar Nights flower | Cedar Nights | 144 | flower | 2026-09-12 | 2026-10-24 |
| Hill Works · Veg 1 | Glass Orchard veg | Glass Orchard | 86 | veg | 2026-09-20 | 2026-11-15 |

Each cycle has timeline, movement, observation, and labor rows. Neither has a harvest result. Dry Room and Mother Room have no active cycle. No alerts, environmental readings, or Metrc sync rows are seeded.

Plant counts on the room and crop cycle are the number of tagged plants assigned to that cycle: 144 on Cedar Nights flower and 86 on Glass Orchard veg. Tags are unique per license. Each plant has a planted event naming the actor.

A saved inventory file is compared per license. Harbor House matches all 144 tags. Hill Works has one extra tag, `1A4HW0000000000000099999`, that is not a local plant. That comparison does not change Harbor House. Metrc credentials can be stored for a later phase and are not sent anywhere. The compliance screen shows import status and discrepancies. Submissions are not built.

The template **Canopy week** (28 days, anchored at `cycle_start`, assigned to the Site operator role) is applied to both active cycles:

| Task | Offset | Due on Flower 1 (start 2026-09-12) | Due on Veg 1 (start 2026-09-20) |
| --- | --- | --- | --- |
| Count plants onto the bench | 0 | 2026-09-12 | 2026-09-20 |
| Scout the canopy | 13 | 2026-09-25 | 2026-10-03 |
| Lower-leaf pass | 21 | 2026-10-03 | 2026-10-11 |

Scout the canopy links the SOP record “Canopy scout” and depends on the count. Lower-leaf pass depends on the scout and requires supervisor approval. On 2026-10-03 in `America/Los_Angeles`, Flower 1’s task due today is Lower-leaf pass and Veg 1’s is Scout the canopy. Blake sees the Harbor House assignment. Casey sees the Hill Works assignment. Avery can open both.

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
- a Site A user cannot read a Site B crop cycle or its history (`403`)
- cycle day matches the stored start date in the site timezone
- facility and room crop fields match the database row
- starting a cycle writes the expected assignees and due dates
- editing a template does not change an existing cycle until a manager applies the new version
- a reschedule preview does not write dates; confirming does
- another site cannot read, comment on, or download a task attachment
- a clean inventory import reconciles to zero discrepancies and does not change plants
- an extra tag on another license is reported and does not change the first license
- a user cannot read another site’s license or plants
- moving a plant writes an event with the actor

The access tests create their own users. They do not depend on the seed passwords above.

To migrate the test database yourself:

```bash
DATABASE_URL=mysql://trim:trim@127.0.0.1:3306/trim_test pnpm db:migrate
```

`dotenv` does not override a `DATABASE_URL` already set in the shell.

## Boundaries

Not built: harvest operations, environmental charts, analytics, reviewed Metrc submissions, the transactional outbox, the SOP library, device adapters, email/SMS, and BullMQ business jobs. The worker only connects to Redis and opens the `trim.infrastructure` queue. Photo attachments use the configured S3 bucket. Inventory import reads a saved file and does not call Metrc.
