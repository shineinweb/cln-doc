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

**Start here**

1. [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) — binding engineering, DB, security, AI, and workflow rules  
2. [AGENTS.md](./AGENTS.md) — monorepo agent guide  
3. [docs/README.md](./docs/README.md) — architecture contracts  

Application implementation has not started yet; docs define the contract.
