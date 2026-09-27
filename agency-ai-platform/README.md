# Agency AI Platform

pnpm monorepo for the Agency AI platform.

| App / package | Role |
| --- | --- |
| `apps/website` | Public React/Vite website |
| `apps/client-portal` | Customer portal |
| `apps/admin` | Employee / admin console |
| `apps/api` | NestJS API |
| `packages/ui` | Shared UI |
| `packages/database` | Database layer |
| `packages/auth` | Authentication |
| `packages/ai` | AI integrations |
| `packages/billing` | Billing |
| `packages/hosting` | Hosting |
| `packages/domains` | Domains |
| `packages/shared` | Shared types & utils |

## Quick start

```bash
cd agency-ai-platform
pnpm install
pnpm dev:website   # http://localhost:5173
pnpm dev:api       # http://localhost:3000
```

See [AGENTS.md](./AGENTS.md) for monorepo conventions.

**Architecture (start here):** [docs/README.md](./docs/README.md) — `ARCHITECTURE`, `DATABASE`, `API`, `SECURITY`, `AI_ARCHITECTURE`, `ROADMAP`.

Application implementation has not started yet; docs define the contract.
