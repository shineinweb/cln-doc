# Architecture

## Apps

- **website** — public marketing and lead capture.
- **client-portal** — authenticated customer experience (projects, billing, hosting).
- **admin** — internal ops (clients, domains, AI tooling, support).
- **api** — NestJS backend; single source of truth for business operations.

## Packages

| Package | Responsibility |
| --- | --- |
| `shared` | Types, constants, pure utilities |
| `ui` | Design system / React components |
| `database` | Schema, Prisma client, migrations |
| `auth` | Identity, sessions, guards helpers |
| `ai` | Model providers, prompts, agent helpers |
| `billing` | Plans, invoices, payment adapters |
| `hosting` | Deploy targets and status |
| `domains` | Registration / DNS adapters |

## Dependency direction

```
apps/*  →  packages/*  →  packages/shared
apps/api → packages/database, auth, ai, billing, hosting, domains
apps/{website,client-portal,admin} → packages/ui, shared, auth (client helpers)
```

Apps must not import each other. Packages may depend on `shared` and, when needed, on sibling packages without cycles.
