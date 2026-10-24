# Instagram AI

Customer workspace, staff admin, API, and worker for planning and publishing Instagram content through Meta’s official APIs. Likes, follows, and unfollows are not implemented.

The customer site and the admin site are separate apps. The customer site has no `/admin` route and no link to the staff panel.

## Requirements

- Node.js 22 or newer
- pnpm 10
- MariaDB 10.11+ (the Compose file uses MariaDB 11) and Redis 7

## Local setup

From `instagram-ai/`:

```bash
pnpm install
cp .env.example .env
docker compose up -d
```

Create the test database once (Compose creates `instagram_ai` only):

```bash
docker compose exec mariadb mariadb -uinstagram -pinstagram -e "CREATE DATABASE IF NOT EXISTS instagram_ai_test;"
```

```bash
pnpm db:push
pnpm db:seed
```

Run four processes:

```bash
pnpm dev:api      # http://localhost:4000
pnpm dev:worker   # scheduled publishes and video jobs
pnpm dev:web      # http://localhost:5173
pnpm dev:admin    # http://localhost:5174
```

The seed staff login is `staff@example.com` / `change-me-now` until you change `STAFF_SEED_PASSWORD`. Signup creates an Owner on a 14-day Starter trial.

`BILLING_DEV_ASSIGN=true` shows package assignment on the billing screen without Stripe. Leave `META_APP_ID` empty to use the fake Instagram client. A real Meta app, Stripe keys, and model keys are read from the environment when you set them. They are not stored in the repo.

Instagram must be able to fetch media when you publish for real. Point `MEDIA_PUBLIC_BASE_URL` at a tunnel or a bucket. Local disk is only the stored bytes behind that URL.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Boundaries

- Official Instagram Login and Graph calls only. No browser automation, session cookies, or unofficial APIs.
- No like, follow, or unfollow automation.
- A person approves a preview before publish.
- Staff cannot read decrypted tokens or publish and reply as a customer.
- Comment text and custom instructions are data. They cannot authorize a follow, a like, or an unsolicited message.
