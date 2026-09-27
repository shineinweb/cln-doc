# AI Architecture

Multi-agent AI subsystem for customer support, sales assistance, coding help, hosting ops, SEO guidance, supervision, RAG, tool calling, memory, feedback, evaluation, human approval, and audit.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md).

---

## 1. Goals

1. Deliver useful assistants in the **customer portal** and **admin** without unsupervised dangerous side effects.
2. Use a **provider interface** layer so OpenAI is the first of potentially many LLM backends.
3. Ground answers in company knowledge via **RAG** (MariaDB-backed embeddings — no PostgreSQL).
4. Orchestrate specialized agents under an **AI Supervisor**.
5. Capture **memory, feedback, evaluation, and audit** for continuous improvement.

### 1.1 Request stack (required)

```text
React (portal / admin)
   ↓  HTTP /api/v1/ai/*
NestJS API (AiController)
   ↓
AiService (@agency/ai)
   ↓
LLMProvider (OpenAiLlmProvider)
   ↓  OpenAiApiTransport (PLACEHOLDER until live SDK wired)
OpenAI
```

**Rules:** React never imports OpenAI or `@agency/ai` providers. Nest controllers never call OpenAI SDKs — only `AiService`.

---

## 2. Provider interfaces (`packages/ai`)

Shipped in `@agency/ai`:

```ts
interface LLMProvider {
  complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream(req: LlmCompletionRequest): AsyncIterable<LlmStreamEvent>;
}

interface EmbeddingProvider {
  embed(req: EmbeddingRequest): Promise<EmbeddingResponse>;
}

interface VectorStore {
  upsert(chunks: VectorUpsert[]): Promise<void>;
  search(query: VectorQuery): Promise<VectorMatch[]>;
  deleteBySource(sourceType: string, sourceId: string): Promise<void>;
}
```

| Interface           | v1 adapter                | Notes                                                                |
| ------------------- | ------------------------- | -------------------------------------------------------------------- |
| `LLMProvider`       | `OpenAiLlmProvider`       | Chat; HTTP transport PLACEHOLDER (`UnwiredOpenAiApiTransport`)       |
| `EmbeddingProvider` | (interface only)          | OpenAI embeddings adapter TBD                                        |
| `VectorStore`       | (interface only)          | MariaDB `KnowledgeChunk.embeddingJson` adapter TBD                   |

Future adapters (Anthropic, Azure OpenAI, external ANN) must not change agent code — only DI bindings.

**Also used by AI tools (other packages):** `PaymentProvider`, `HostingProvider`, `DomainProvider`, `DnsProvider`, `EmailProvider`, `StorageProvider` — agents never import vendor SDKs.

**HTTP:** authenticated `POST /api/v1/ai/complete` → Nest `AiModule` → `AiService.complete`.

---

## 3. Agent roster

```text
                  AI SUPERVISOR
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
 Customer Support     Coding           Hosting
       │                │                 │
       ├────────────── Sales ─────────────┤
       │                                  │
      SEO                              Knowledge
```

| Agent               | Codename     | Tier           | Primary users                     | Responsibility                                                            |
| ------------------- | ------------ | -------------- | --------------------------------- | ------------------------------------------------------------------------- |
| **AI Supervisor**   | `supervisor` | supervisor     | System                            | Route intents, pick specialist, enforce policies, synthesize final answer |
| **Customer Support**| `support`    | primary        | Portal + admin support            | Tickets, KB answers, troubleshooting                                      |
| **Coding**          | `coding`     | primary        | Staff (optionally limited portal) | Implementation guidance, code review assist, task breakdown               |
| **Hosting**         | `hosting`    | primary        | Staff + constrained portal        | Hosting diagnostics, WHM-safe recommendations/actions                     |
| **Sales**           | `sales`      | cross_cutting  | Staff (+ website assist later)    | Qualification, quote drafts, plan recommendations (spans primary lanes)   |
| **SEO**             | `seo`        | specialty      | Staff (+ portal read-only tips)   | Audits, content recommendations, keyword research assist                  |
| **Knowledge**       | `knowledge`  | specialty      | Staff + RAG ops                   | Collection scoping, retrieval quality, KB curation assist                 |

All specialists `reportsTo: supervisor`. Source of truth: `AI_AGENT_ROSTER` / `AI_ORG_CHART` in `@agency/ai`.

Each agent has:

- System prompt + version (`AiAgentVersion`)
- Tool allowlist
- Model config (temperature, max tokens, model name)
- Policy profile (what requires approval)
- RAG collections it may read

---

## 4. Runtime orchestration

```text
User message
    │
    ▼
Conversation service (persist AiMessage)
    │
    ▼
Supervisor agent
    ├─ classify intent / risk
    ├─ retrieve RAG context (scoped)
    ├─ select specialist agent(s)
    └─ merge / finalize response
            │
            ▼
      Specialist run (AiRun)
            ├─ LLM + tools
            ├─ optional approval gates
            └─ stream tokens → WS
    │
    ▼
Persist messages, tool calls, feedback hooks, audit
```

### 4.1 Execution venues

| Venue                      | Trigger                                               |
| -------------------------- | ----------------------------------------------------- |
| Interactive (portal/admin) | User sends message → API → queue or inline stream     |
| Ticket assist              | Staff clicks “AI draft” or auto-suggest on new ticket |
| Background                 | Reindex RAG, eval suites, memory compaction           |

Long or tool-heavy runs go through **BullMQ `ai` queue** so HTTP workers stay responsive.

### 4.2 Multi-agent patterns

1. **Supervisor routes → single specialist** (default).
2. **Supervisor fans out** (e.g. sales + SEO) then synthesizes (costly; gated).
3. **Human approval interrupt** pauses run until staff decides.

---

## 5. Tool calling

Tools are typed functions registered in a **tool registry**, exposed to the LLM as JSON schemas.

### 5.1 Tool categories

| Risk              | Examples                                                                    | Gate                        |
| ----------------- | --------------------------------------------------------------------------- | --------------------------- |
| **Read-only**     | `kb.search`, `ticket.get`, `invoice.list`, `dns.list`, `hosting.status`     | Auto                        |
| **Draft**         | `quote.draft`, `email.draft`, `ticket.reply.draft`                          | Auto; human sends           |
| **Mutating low**  | `ticket.tag`, `notification.create`                                         | Auto or soft confirm        |
| **Mutating high** | `hosting.suspend`, `dns.delete_record`, `domain.transfer`, `billing.refund` | **Human approval required** |

### 5.2 Tool handler rules

1. Handlers call domain services / providers — never raw SQL or SDKs.
2. Handlers re-check authZ with the **initiating user’s** (or system job’s) principal.
3. Arguments validated with schemas; outputs size-limited before returning to the model.
4. Every invocation stored as `AiToolCall` with latency, status, error.

### 5.3 Customer Support tool surface (v1)

Portal-scoped tools on the **Customer Support** agent (`CUSTOMER_SUPPORT_TOOL_NAMES`):

```text
getCurrentCustomer()
getCustomerServices()
getCustomerDomains()
getCustomerHosting()
getCustomerInvoices()
getCustomerTickets()
searchKnowledge()
createTicket()
replyTicket()
```

| Tool                   | Risk  | Approval                                      |
| ---------------------- | ----- | -------------------------------------------- |
| `getCurrentCustomer`   | read  | Session customer profile                     |
| `getCustomerServices`  | read  | Active / pending services                    |
| `getCustomerDomains`   | read  | Customer domains                             |
| `getCustomerHosting`   | read  | Hosting accounts + status                    |
| `getCustomerInvoices`  | read  | Invoices (optional status filter)            |
| `getCustomerTickets`   | read  | Tickets (optional status filter)             |
| `searchKnowledge`      | read  | RAG over published KB chunks                 |
| `createTicket`         | write | New ticket (dept, subject, body, priority)   |
| `replyTicket`          | write | Customer reply on own ticket                 |

Handlers are PLACEHOLDER (`invokeTool` → `AiToolUnwiredError`) until Nest binds domain services. AuthZ always uses the initiating customer principal — no cross-tenant reads.

### 5.4 Coding tool surface (v1)

Staff / project-scoped tools on the **Coding** agent (`CODING_TOOL_NAMES`):

```text
readRepository()
searchCode()
explainCode()
diagnoseErrors()
generateCode()
generateTests()
runTests()
reviewChanges()
createBranches()
createPullRequests()
```

| Tool                  | Risk  | Approval / gate                                              |
| --------------------- | ----- | ------------------------------------------------------------ |
| `readRepository`      | read  | Repo tree / file contents                                  |
| `searchCode`          | read  | Symbol / text / path search                                  |
| `explainCode`         | read  | Plain-language explanation of files/symbols                  |
| `diagnoseErrors`      | read  | Analyze lint/typecheck/runtime logs                          |
| `generateCode`        | write | Draft patch only (not applied to production)                 |
| `generateTests`       | write | Draft tests for scoped change                                |
| `runTests`            | write | Sandboxed test run                                           |
| `reviewChanges`       | read  | Diff / working-tree review                                   |
| `createBranches`      | write | **Requires approval** — branch policy enforced               |
| `createPullRequests`  | write | **Requires approval** — draft PR; no auto-merge / deploy     |

**Non-goals for Coding AI:** autonomous production deploys, unrestricted shell, merging to protected branches without staff.

### 5.5 Coding delivery pipeline

```text
AI CODE
   ↓
BRANCH
   ↓
TEST
   ↓
PULL REQUEST
   ↓
HUMAN REVIEW
   ↓
MERGE
   ↓
DEPLOY
```

| Stage            | Codename         | Actors           | Coding AI? | Notes                                      |
| ---------------- | ---------------- | ---------------- | ---------- | ------------------------------------------ |
| **AI Code**      | `ai_code`        | coding_ai        | yes        | Draft code/tests via tools                 |
| **Branch**       | `branch`         | coding_ai, human | yes*       | `createBranches` — approval required       |
| **Test**         | `test`           | coding_ai, ci    | yes        | Sandboxed `runTests`                       |
| **Pull Request** | `pull_request`   | coding_ai, human | yes*       | `createPullRequests` — approval; no merge  |
| **Human Review** | `human_review`   | human            | **no**     | Staff approve / request changes            |
| **Merge**        | `merge`          | human            | **no**     | Protected base; human only                 |
| **Deploy**       | `deploy`         | human, ci        | **no**     | Never triggered by Coding AI               |

\* Branch and PR creation still require human approval gates. Source of truth: `CODING_PIPELINE` in `@agency/ai`.

### 5.6 Hosting diagnostic pipeline

```text
Customer request
        ↓
Hosting AI
        ↓
Identify hosting account
        ↓
Check server
        ↓
Check DNS
        ↓
Check SSL
        ↓
Check service status
        ↓
Read safe logs
        ↓
Search knowledge
        ↓
Diagnosis
```

| Stage                      | Codename                   | Tool                     | Notes                                      |
| -------------------------- | -------------------------- | ------------------------ | ------------------------------------------ |
| Customer request           | `customer_request`         | —                        | Supervisor routes                          |
| Hosting AI                 | `hosting_ai`               | —                        | Specialist handoff                         |
| Identify hosting account   | `identify_hosting_account` | `identifyHostingAccount` | HostingProvider lookup                     |
| Check server               | `check_server`             | `checkServer`            | Read-only host health                      |
| Check DNS                  | `check_dns`                | `checkDns`               | DnsProvider                                |
| Check SSL                  | `check_ssl`                | `checkSsl`               | Cert status                                |
| Check service status       | `check_service_status`     | `checkServiceStatus`     | HTTP/service probe                         |
| Read safe logs             | `read_safe_logs`           | `readSafeLogs`           | Allowlisted + redacted only                |
| Search knowledge           | `search_knowledge`         | `searchKnowledge`        | RAG runbooks                               |
| Diagnosis                  | `diagnosis`                | `diagnoseHosting`        | Synthesize; **no mutations**               |

All stages are **read-only**. Source of truth: `HOSTING_PIPELINE` / `HOSTING_TOOL_NAMES` in `@agency/ai`. Still forbidden: `AI → production server → randomly change files`.

**Also planned (other agents):** `quote.create_draft`, `hosting.restart_service` (approval), `dns.apply_record_change` (approval), `billing.issue_refund` (approval).

---

## 6. Human approval system

```text
Tool call requested (high risk)
    → AiApproval created (status=pending)
    → WS event to admin:ops / approvers
    → Run pauses (or continues with read-only path)
    → Staff approve/deny (+ note)
    → On approve: execute tool once; audit
    → On deny: inform agent; continue with explanation
```

**Policies** stored per agent version (and global deny list). Approvals expire; expired = deny.

Portal customers **never** approve infrastructure-destructive tools; only staff with `ai.approvals.decide`.

---

## 7. Knowledge / RAG

### 7.1 Sources

| Source                           | Visibility                        | Use                      |
| -------------------------------- | --------------------------------- | ------------------------ |
| Published KB articles            | public / internal                 | Support + public assist  |
| Blog / portfolio                 | public                            | Sales / marketing Q&A    |
| Internal runbooks                | internal                          | Staff agents only        |
| Ticket macros / resolved tickets | internal, optionally org-scrubbed | Support (careful PII)    |
| Project docs (opt-in)            | organization                      | Portal project assistant |
| Uploaded files                   | per ACL                           | Scoped retrieval         |

### 7.2 Pipeline

```text
Source change → BullMQ index job
  → extract text
  → chunk (token-aware)
  → EmbeddingProvider.embed
  → VectorStore.upsert (MariaDB KnowledgeChunk.embeddingJson)
```

Unpublish/delete → `deleteBySource`.

### 7.3 Retrieval

1. Embed query
2. Filter by visibility + org scope + agent-allowed collections
3. Top-k cosine (v1) / ANN (v2)
4. Rerank lightly (optional LLM or heuristic)
5. Inject into specialist prompt as **untrusted** context blocks

### 7.4 Anti-patterns

- No cross-org private chunk retrieval
- No dumping entire tickets into sales agent context
- No PostgreSQL/`pgvector`

---

## 8. Memory

| Type                    | Scope            | Lifecycle                                        |
| ----------------------- | ---------------- | ------------------------------------------------ |
| Conversation buffer     | `AiConversation` | Short-term; truncated/summarized                 |
| User memory             | userId (+ org)   | Explicit preferences (“prefers concise answers”) |
| Organization memory     | organizationId   | Account facts approved for reuse                 |
| Agent procedural memory | agentId          | Playbooks / learned tips (staff-reviewed)        |

`AiMemory` items have: `kind`, `content`, `importance`, `expiresAt?`, `sourceRunId?`.

Memory writes from AI are **rate-limited** and may require approval when they store sensitive PII.

---

## 9. Feedback & evaluation

### 9.1 Feedback

- Portal/admin thumbs up/down + optional comment → `AiFeedback`
- Ticket “AI draft accepted/edited/rejected” signals
- Used for offline eval sets and prompt regression

### 9.2 Evaluation

| Mode            | Description                                |
| --------------- | ------------------------------------------ |
| Golden sets     | Curated Q/A with expected citations/tools  |
| Regression      | Run on agent version change                |
| Online sampling | Sample production runs for human review    |
| Safety evals    | Prompt-injection and high-risk tool suites |

Results in `AiEvaluation` (scores, notes, agentVersionId). Shipping a new agent version requires eval gate in process (roadmap ceremony).

---

## 10. Observability & audit

Every interactive turn produces:

- `AiRun` (agent, model, token usage, cost estimate, status)
- `AiMessage` trail
- `AiToolCall` rows
- `AiApproval` when applicable
- `AiAuditEvent` for security-relevant steps
- Platform `AuditLog` for approvals and executed high-risk tools

Admin AI management UI (future) lists runs, failures, cost, approval queue, eval scores.

---

## 11. Safety & policy engine

Central policy checks **before** tool execution:

1. Agent allowlist contains tool?
2. Principal has permission for underlying action?
3. Organization quota remaining?
4. Risk level → auto vs approval?
5. Content filters (PII export, secret exfiltration patterns)?

Supervisor may refuse out-of-policy requests with a safe explanation.

---

## 12. Streaming & UX contracts

1. Client creates/continues conversation via REST.
2. Subscribes to `ai:conversation:{id}` WS room.
3. Events: `ai.token`, `ai.tool.start`, `ai.tool.result`, `ai.approval_required`, `ai.message.completed`, `ai.error`.
4. Partial failures show recoverable errors; never silent tool side effects.

---

## 13. Cost controls

- Per-org monthly token budget
- Per-agent max tokens / tool iterations
- Cache embeddings for unchanged chunks
- Prefer smaller models for supervisor classification
- Hard kill-switch setting `ai.enabled=false`

---

## 14. Package module map (`packages/ai`)

```text
packages/ai/
  providers/      # LLM, Embedding, VectorStore + OpenAI adapters
  agents/         # AI Supervisor org chart + specialist roster
  tools/          # Tool registry (provider-backed handlers later)
  knowledge/      # RAG chunking + retrieval orchestration
  memory/         # Memory write/read policies
  evaluations/    # Eval harness stubs
  approvals/      # Human-in-the-loop gates
  security/       # Kill switch, quotas, risk defaults
```

Nest `AiModule` wires DI; BullMQ processors live under `apps/api` workers (or `packages/queue`).
Sources live under `packages/ai/src/<module>/`.

---

## 15. Explicit non-goals (this phase)

- No fine-tuning pipeline
- No customer-hosted model runtime
- No autonomous production deploys by Coding AI
- No unrestricted shell/code execution tools

### 15.1 Forbidden path (hard deny)

```text
AI → production server → randomly change files
```

**Never allowed.** Coding AI must not SSH/SFTP/API into production hosts to mutate files. Source of truth: `FORBIDDEN_AI_PATHS` / `assertCodingPathAllowed` in `@agency/ai`. Allowed path remains the delivery pipeline (AI Code → … → Human Review → Merge → Deploy).
