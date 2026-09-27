# Deployment & release pipeline

Canonical path from local work to production for the Agency AI Platform.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), [ROADMAP.md](./ROADMAP.md).  
Encoded in `@agency/shared` as `RELEASE_PIPELINE` / `RELEASE_PIPELINE_STAGES`.

---

## Pipeline

```text
Development
     ↓
GitHub
     ↓
Staging
     ↓
Automated tests
     ↓
Manual approval
     ↓
Production
```

| Stage           | Who              | What happens                                                               |
| --------------- | ---------------- | -------------------------------------------------------------------------- |
| Development     | Developer        | Feature branch (`cursor/*`) off `dev`; local lint/typecheck/test           |
| GitHub          | Developer + CI   | Push / PR; review; CI on the PR (lint, typecheck, tests, build)            |
| Staging         | CI / operator    | Deploy candidate to staging (migrations + apps)                            |
| Automated tests | CI               | Full suites against the staging candidate (incl. authz / tenant isolation) |
| Manual approval | Human            | Explicit promote — GitHub Environment protection or release approver       |
| Production      | CI after approve | Production deploy; never by Coding AI alone                                |

**Hard rule:** Production requires **manual approval**. Coding AI stops at PR / human review (see Coding AI pipeline in [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)).

---

## GitHub Actions

| Workflow                                           | Trigger                          | Role in pipeline       |
| -------------------------------------------------- | -------------------------------- | ---------------------- |
| `.github/workflows/agency-ai-platform-ci.yml`      | PR / push to `dev`               | GitHub + test gates    |
| `.github/workflows/agency-ai-platform-release.yml` | Manual `workflow_dispatch` / tag | Staging → tests → prod |

Configure a GitHub Environment named `production` with **required reviewers** so the Manual approval stage cannot be skipped.

---

## Commands (every stage should stay green)

From `agency-ai-platform/`:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:api
pnpm test:authorization
pnpm test:tenant-isolation
pnpm build
```

---

## Environments

| Environment | Purpose                            | Secrets                        |
| ----------- | ---------------------------------- | ------------------------------ |
| Local       | Docker Compose MariaDB + Redis     | `.env` (gitignored)            |
| Staging     | Pre-prod soak, webhook/AI dry-runs | Staging secret manager         |
| Production  | Live traffic                       | Production secret manager only |

Never reuse production Stripe/OpenAI secrets in staging. Fail boot if webhook secrets are placeholders (see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)).

---

## Rollback

1. Redeploy previous known-good image/commit to Production (after approval if policy requires).
2. Prisma: prefer forward fixes; keep `db:migrate:deploy` history; never hand-edit prod schema.
3. Kill switch: disable AI via security policy / feature flag if a bad AI release ships.

---

## Explicit non-goals

- Autonomous Coding AI deploy to Production
- Skipping Manual approval for Production
- Deploying from unreviewed `dev` commits without Staging + automated tests
