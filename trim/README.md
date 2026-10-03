# Trim

Trim is a multi-site cannabis cultivation workspace. Phase 1 covers access and the organization → site → room → zone model. Phase 2 adds crop cycles and the room dashboard. Phase 3 adds versioned workflow templates, generated assignments, and the employee workspace. Phase 4 tracks plants by license and compares a saved inventory file. Phase 5 reviews Metrc submissions and delivers approved rows through a sandbox outbox. Phase 6 records a harvest, its weights, waste, and packages, and can queue a finished package on that same outbox. Phase 7 records room environment readings by hand or CSV, charts them, and raises stale and out-of-range alerts.

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

Each cycle has timeline, movement, observation, and labor rows. Neither has a harvest result. Dry Room and Mother Room have no active cycle. No Metrc sync rows are seeded.

Flower 1’s stale threshold is 60 minutes. Its temperature readings are current (`hh-flower-1-temp`, newest about 10 minutes old). Relative humidity (`hh-flower-1-rh`, 58.2%) is three hours old and stale, and one active alert says so. A CO₂ row from `sample-co2-logger` is stored and labeled as sample data. Substrate has no reading, so that metric is shown as stale without its own alert. Veg 1 has a current temperature from `hw-veg-1-temp` and no alert. Timestamps are stored in UTC and shown in `America/Los_Angeles`.

Plant counts on the room and crop cycle are the number of tagged plants assigned to that cycle: 144 on Cedar Nights flower and 86 on Glass Orchard veg. Tags are unique per license. Each plant has a planted event naming the actor.

A saved inventory file is compared per license. Harbor House matches all 144 tags. Hill Works has one extra tag, `1A4HW0000000000000099999`, that is not a local plant. That comparison does not change Harbor House. Metrc credentials can be stored for a later phase and are not sent anywhere. The compliance screen shows import discrepancies plus pending review, failures, and uncertain submissions. Three changes are waiting for review: a Harbor House move (sandbox success), a Hill Works stage change (definite failure), and a Harbor House stage change (uncertain). Avery can review both licenses. Blake cannot read Hill Works submissions.

The template **Canopy week** (28 days, anchored at `cycle_start`, assigned to the Site operator role) is applied to both active cycles:

| Task | Offset | Due on Flower 1 (start 2026-09-12) | Due on Veg 1 (start 2026-09-20) |
| --- | --- | --- | --- |
| Count plants onto the bench | 0 | 2026-09-12 | 2026-09-20 |
| Scout the canopy | 13 | 2026-09-25 | 2026-10-03 |
| Lower-leaf pass | 21 | 2026-10-03 | 2026-10-11 |

Scout the canopy links the SOP record “Canopy scout” and depends on the count. Lower-leaf pass depends on the scout and requires supervisor approval. On 2026-10-03 in `America/Los_Angeles`, Flower 1’s task due today is Lower-leaf pass and Veg 1’s is Scout the canopy. Blake sees the Harbor House assignment. Casey sees the Hill Works assignment. Avery can open both.

## Harvest

Flower 1’s Cedar Nights plants can be harvested from the room. The harvest stores each plant tag, then wet weight, drying, dry weight, trimming, waste, and packages. Each of those rows stores the actor, the time, and the harvest. A package lists the source tags. The screen shows dry weight, packaged weight, waste, and the unaccounted remainder. Hill Works Veg 1 stays in the room. A separate Hill Works prior lot exists so a Harbor House user can be denied that URL. A finished package is queued as a pending Metrc submission and is not sent until a manager approves it.

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
- an unapproved submission is not delivered
- approval writes exactly one outbox row
- sandbox success, failure, and uncertain outcomes are stored with the actor, time, and request id
- an uncertain change cannot be submitted again until reconciliation marks it landed or not landed
- another license’s submissions are denied
- a package traces back to the harvested plant tags
- waste stores the actor
- a plant that is not on the harvest cannot be packaged
- harvest, waste, and package reads are denied across sites and licenses
- package weight plus waste accounts for the recorded dry weight
- a reading older than the room’s stale threshold is stale, and a metric with no reading is stale
- a live reading outside its alert range creates an active alert, and a later in-range reading clears it
- a CSV import stores device, unit, site-local timestamp, quality, and the sample flag
- another site cannot read a room’s environmental reading

The access tests create their own users. They do not depend on the seed passwords above.

To migrate the test database yourself:

```bash
DATABASE_URL=mysql://trim:trim@127.0.0.1:3306/trim_test pnpm db:migrate
```

`dotenv` does not override a `DATABASE_URL` already set in the shell.

## Boundaries

Not built: yield, labor, and cost analytics, the SOP library, device adapters, and email/SMS. Environmental readings are entered by hand or CSV. Charts and alerts use those rows. Weights are typed by hand. Inventory import and submission delivery do not call Metrc. The worker delivers approved outbox rows, including a queued package, to a sandbox that can succeed, fail, or time out.
