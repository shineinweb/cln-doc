# AI Architecture

Multi-agent AI subsystem for customer support, sales assistance, coding help, hosting ops, SEO guidance, supervision, RAG, tool calling, memory, feedback, evaluation, human approval, and audit.

**Implementation note:** this document defines architecture only. No production AI runtime code in this phase.

Companion: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATABASE.md](./DATABASE.md), [API.md](./API.md), [SECURITY.md](./SECURITY.md).

---

## 1. Goals

1. Deliver useful assistants in the **customer portal** and **admin** without unsupervised dangerous side effects.
2. Use a **provider interface** layer so OpenAI is the first of potentially many LLM backends.
3. Ground answers in company knowledge via **RAG** (MariaDB-backed embeddings — no PostgreSQL).
4. Orchestrate specialized agents under an **AI Supervisor**.
5. Capture **memory, feedback, evaluation, and audit** for continuous improvement.

---

## 2. Provider interfaces (`packages/ai`)

```ts
// Conceptual contracts — final signatures live in packages/ai when implemented

interface LLMProvider {
  complete(req: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream(req: LlmCompletionRequest): AsyncIterable<LlmStreamEvent>;
}

interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

interface VectorStore {
  upsert(chunks: VectorUpsert[]): Promise<void>;
  search(query: VectorQuery): Promise<VectorMatch[]>;
  deleteBySource(sourceType: string, sourceId: string): Promise<void>;
}
```

| Interface | v1 adapter | Notes |
| --- | --- | --- |
| `LLMProvider` | `OpenAiLlmProvider` | Chat + tool calling |
| `EmbeddingProvider` | `OpenAiEmbeddingProvider` | Batch embeddings |
| `VectorStore` | `MariaDbVectorStore` | Chunks + embeddings in MariaDB; in-process cosine over filtered sets |

Future adapters (Anthropic, Azure OpenAI, external ANN) must not change agent code — only DI bindings.

**Also used by AI tools (other packages):** `PaymentProvider`, `HostingProvider`, `DomainProvider`, `DnsProvider`, `EmailProvider`, `StorageProvider` — agents never import vendor SDKs.

---

## 3. Agent roster

| Agent | Codename | Primary users | Responsibility |
| --- | --- | --- | --- |
| **AI Supervisor** | `supervisor` | System | Route intents, pick specialist, enforce policies, synthesize final answer |
| **Customer Support AI** | `support` | Portal + admin support | Tickets, KB answers, troubleshooting |
| **Coding AI** | `coding` | Staff (optionally limited portal) | Implementation guidance, code review assist, task breakdown |
| **Hosting AI** | `hosting` | Staff + constrained portal | Hosting diagnostics, WHM-safe recommendations/actions |
| **Sales AI** | `sales` | Staff (+ website assist later) | Qualification, quote drafts, plan recommendations |
| **SEO AI** | `seo` | Staff (+ portal read-only tips) | Audits, content recommendations, keyword research assist |

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

| Venue | Trigger |
| --- | --- |
| Interactive (portal/admin) | User sends message → API → queue or inline stream |
| Ticket assist | Staff clicks “AI draft” or auto-suggest on new ticket |
| Background | Reindex RAG, eval suites, memory compaction |

Long or tool-heavy runs go through **BullMQ `ai` queue** so HTTP workers stay responsive.

### 4.2 Multi-agent patterns

1. **Supervisor routes → single specialist** (default).
2. **Supervisor fans out** (e.g. sales + SEO) then synthesizes (costly; gated).
3. **Human approval interrupt** pauses run until staff decides.

---

## 5. Tool calling

Tools are typed functions registered in a **tool registry**, exposed to the LLM as JSON schemas.

### 5.1 Tool categories

| Risk | Examples | Gate |
| --- | --- | --- |
| **Read-only** | `kb.search`, `ticket.get`, `invoice.list`, `dns.list`, `hosting.status` | Auto |
| **Draft** | `quote.draft`, `email.draft`, `ticket.reply.draft` | Auto; human sends |
| **Mutating low** | `ticket.tag`, `notification.create` | Auto or soft confirm |
| **Mutating high** | `hosting.suspend`, `dns.delete_record`, `domain.transfer`, `billing.refund` | **Human approval required** |

### 5.2 Tool handler rules

1. Handlers call domain services / providers — never raw SQL or SDKs.
2. Handlers re-check authZ with the **initiating user’s** (or system job’s) principal.
3. Arguments validated with schemas; outputs size-limited before returning to the model.
4. Every invocation stored as `AiToolCall` with latency, status, error.

### 5.3 Example tool surface (illustrative)

```text
kb.search
kb.get_article
ticket.get / ticket.list_related
project.get_status
billing.get_invoice
hosting.get_account
dns.list_records
crm.find_lead          (admin/sales only)
quote.create_draft     (sales)
hosting.restart_service  (approval)
hosting.suspend_account  (approval)
dns.apply_record_change  (approval)
billing.issue_refund     (approval)
```

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

| Source | Visibility | Use |
| --- | --- | --- |
| Published KB articles | public / internal | Support + public assist |
| Blog / portfolio | public | Sales / marketing Q&A |
| Internal runbooks | internal | Staff agents only |
| Ticket macros / resolved tickets | internal, optionally org-scrubbed | Support (careful PII) |
| Project docs (opt-in) | organization | Portal project assistant |
| Uploaded files | per ACL | Scoped retrieval |

### 7.2 Pipeline

```text
Source change → BullMQ index job
  → extract text
  → chunk (token-aware)
  → EmbeddingProvider.embed
  → VectorStore.upsert (MariaDB KnowledgeChunk + KnowledgeEmbedding)
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

| Type | Scope | Lifecycle |
| --- | --- | --- |
| Conversation buffer | `AiConversation` | Short-term; truncated/summarized |
| User memory | userId (+ org) | Explicit preferences (“prefers concise answers”) |
| Organization memory | organizationId | Account facts approved for reuse |
| Agent procedural memory | agentId | Playbooks / learned tips (staff-reviewed) |

`AiMemory` items have: `kind`, `content`, `importance`, `expiresAt?`, `sourceRunId?`.

Memory writes from AI are **rate-limited** and may require approval when they store sensitive PII.

---

## 9. Feedback & evaluation

### 9.1 Feedback

- Portal/admin thumbs up/down + optional comment → `AiFeedback`
- Ticket “AI draft accepted/edited/rejected” signals
- Used for offline eval sets and prompt regression

### 9.2 Evaluation

| Mode | Description |
| --- | --- |
| Golden sets | Curated Q/A with expected citations/tools |
| Regression | Run on agent version change |
| Online sampling | Sample production runs for human review |
| Safety evals | Prompt-injection and high-risk tool suites |

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
  src/
    providers/          # LLM, Embedding, VectorStore interfaces + adapters
    agents/             # Supervisor + specialists (defs, prompts)
    tools/              # Registry + handlers (call into other packages)
    rag/                # Chunking, indexing, retrieval
    memory/             # Memory read/write policies
    policy/             # Risk, approval, quotas
    evaluation/         # Harness
    audit/              # AI audit helpers
```

Nest `AiModule` wires DI; BullMQ processors live under `apps/api` workers (or `packages/queue`).

---

## 15. Explicit non-goals (this phase)

- No fine-tuning pipeline
- No customer-hosted model runtime
- No autonomous production deploys by Coding AI
- No unrestricted shell/code execution tools
