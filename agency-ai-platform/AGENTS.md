# Agency AI Platform — Agent Guide

Monorepo for an agency operating system: public marketing site, client portal, internal admin, and NestJS API, with shared packages for UI, data, auth, AI, billing, hosting, and domains.

## Layout

```
apps/
  website/         # Public React/Vite site
  client-portal/   # Customer React/Vite app
  admin/           # Employee/admin React/Vite app
  api/             # NestJS API
packages/
  ui/              # Shared React components & design tokens
  database/        # Prisma schema, client, migrations
  auth/            # Auth helpers, session/JWT utilities
  ai/              # AI providers & agent tooling
  billing/         # Subscriptions, invoices, Stripe adapters
  hosting/         # Deploy/hosting integrations
  domains/         # Domain DNS & registration adapters
  shared/          # Cross-cutting types, utils, constants
docs/              # Architecture & product docs
.cursor/rules/     # Cursor project rules
```

## Tooling

- **Package manager:** pnpm workspaces (`pnpm-workspace.yaml`)
- **Language:** TypeScript (strict), shared `tsconfig.base.json`
- **Frontends:** React + Vite (`website`, `client-portal`, `admin`)
- **Backend:** NestJS (`api`)
- **Node:** >= 22

## Commands

From `agency-ai-platform/`:

```bash
pnpm install
pnpm dev:website    # :5173
pnpm dev:portal     # :5174
pnpm dev:admin      # :5175
pnpm dev:api        # :3000
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## Conventions

1. Prefer package imports via workspace names (`@agency/ui`, `@agency/shared`, …). Do not deep-import another app’s internals.
2. Put domain logic in `packages/*`; keep apps thin (routing, composition, Nest modules).
3. Shared types and pure helpers belong in `@agency/shared`.
4. Database access goes through `@agency/database` — no ad-hoc clients in apps.
5. Auth, billing, hosting, domains, and AI stay behind their package boundaries so adapters can swap.
6. Match existing patterns in neighboring packages before inventing new ones.
7. Do not commit secrets; use `.env.example` and local `.env` only.

## Cursor rules

Project-specific rules live in `.cursor/rules/`. Read them before large refactors or new package work.
