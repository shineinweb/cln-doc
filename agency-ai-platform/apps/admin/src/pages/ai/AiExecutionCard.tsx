import { useState } from "react";
import {
  formatAiExecutionTitle,
  type AiExecution,
  type ApprovalDecision,
} from "@agency/ai";
import { StatusPill } from "@/components/ui/StatusPill";

export function AiExecutionCard({
  execution,
  onDecide,
}: {
  execution: AiExecution;
  onDecide?: (decision: "approved" | "denied") => void;
}) {
  const [status, setStatus] = useState<ApprovalDecision>(execution.status);
  const pending = status === "pending";

  function decide(decision: "approved" | "denied") {
    setStatus(decision);
    onDecide?.(decision);
  }

  return (
    <article className="surface animate-rise rounded-2xl p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-bold tracking-wide text-[var(--color-accent)] uppercase">
            {formatAiExecutionTitle(execution)}
          </p>
          <h2 className="font-display mt-1 text-xl font-bold">
            {execution.requestedAction}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={execution.riskLevel} />
          <StatusPill label={status} />
        </div>
      </header>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
            Agent
          </dt>
          <dd className="mt-1 font-semibold">{execution.agentLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
            Customer
          </dt>
          <dd className="mt-1 font-semibold">{execution.customerName}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
            Question
          </dt>
          <dd className="mt-1 italic text-[var(--fg)]">“{execution.question}”</dd>
        </div>
      </dl>

      <section className="mt-4">
        <h3 className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
          Tools
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {execution.tools.map((tool) => (
            <li
              key={tool.name}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-mono text-xs"
            >
              <span className={tool.ok ? "text-[var(--color-accent)]" : "text-[var(--color-danger)]"}>
                {tool.ok ? "✓" : "✗"}
              </span>{" "}
              {tool.name}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] p-3">
          <h3 className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
            Diagnosis
          </h3>
          <p className="mt-1 text-sm font-semibold">{execution.diagnosis}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] p-3">
          <h3 className="text-xs font-bold tracking-wide text-[var(--fg-muted)] uppercase">
            Requested action
          </h3>
          <p className="mt-1 text-sm font-semibold">{execution.requestedAction}</p>
          <p className="text-muted mt-1 font-mono text-[11px]">
            {execution.requestedToolName}
          </p>
        </div>
      </section>

      <footer className="relative z-10 mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!pending}
          onClick={() => decide("approved")}
          className="relative z-10 cursor-pointer rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!pending}
          onClick={() => decide("denied")}
          className="relative z-10 cursor-pointer rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject
        </button>
        {!pending ? (
          <p className="text-muted self-center text-xs">
            Decision recorded locally (PLACEHOLDER — Nest persists AiApproval next).
          </p>
        ) : null}
      </footer>
    </article>
  );
}
