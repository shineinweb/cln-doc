import { Navigate, useParams } from "react-router-dom";
import {
  AI_AGENT_ROSTER,
  FORBIDDEN_AI_PATHS,
  getAdminAiSectionByPath,
  listSpecialists,
} from "@agency/ai";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PLACEHOLDER_AI_APPROVALS,
  PLACEHOLDER_AI_CONVERSATIONS,
  PLACEHOLDER_AI_COSTS,
  PLACEHOLDER_AI_EVALUATIONS,
  PLACEHOLDER_AI_FAILURES,
  PLACEHOLDER_AI_FEEDBACK,
  PLACEHOLDER_AI_KNOWLEDGE_JOBS,
  PLACEHOLDER_AI_RUNS,
  PLACEHOLDER_AI_SECURITY_EVENTS,
  PLACEHOLDER_AI_TOKEN_USAGE,
  PLACEHOLDER_AI_TOOL_CALLS,
} from "@/data/placeholders";

export function AiSectionPage() {
  const { sectionPath } = useParams<{ sectionPath: string }>();
  const section = sectionPath ? getAdminAiSectionByPath(sectionPath) : undefined;
  if (!section) {
    return <Navigate to="/admin/ai" replace />;
  }

  return (
    <>
      <PageHeader
        title={section.label}
        description={`${section.description} Target API: GET /api/v1${section.apiPath}`}
      />
      <PlaceholderBadge />
      {section.key === "agents" ? <AgentsPanel /> : null}
      {section.key === "conversations" ? (
        <SimpleTable
          columns={["ID", "Agent", "User", "Messages", "Updated"]}
          rows={PLACEHOLDER_AI_CONVERSATIONS.map((row) => [
            row.id,
            row.agent,
            row.user,
            String(row.messages),
            row.updatedAt,
          ])}
        />
      ) : null}
      {section.key === "tool_calls" ? (
        <SimpleTable
          columns={["ID", "Tool", "Agent", "Risk", "Status", "Latency"]}
          rows={PLACEHOLDER_AI_TOOL_CALLS.map((row) => [
            row.id,
            row.toolName,
            row.agent,
            row.risk,
            row.status,
            row.latencyMs,
          ])}
        />
      ) : null}
      {section.key === "costs" ? (
        <SimpleTable
          columns={["Period", "Agent", "Model", "Cost (USD)"]}
          rows={PLACEHOLDER_AI_COSTS.map((row) => [
            row.period,
            row.agent,
            row.model,
            row.costUsd,
          ])}
        />
      ) : null}
      {section.key === "token_usage" ? (
        <SimpleTable
          columns={["Period", "Prompt", "Completion", "Total", "Budget used"]}
          rows={PLACEHOLDER_AI_TOKEN_USAGE.map((row) => [
            row.period,
            String(row.promptTokens),
            String(row.completionTokens),
            String(row.totalTokens),
            row.budgetUsed,
          ])}
        />
      ) : null}
      {section.key === "knowledge" ? (
        <SimpleTable
          columns={["Job", "Source", "Status", "Chunks", "Updated"]}
          rows={PLACEHOLDER_AI_KNOWLEDGE_JOBS.map((row) => [
            row.id,
            row.source,
            row.status,
            String(row.chunks),
            row.updatedAt,
          ])}
        />
      ) : null}
      {section.key === "feedback" ? (
        <SimpleTable
          columns={["ID", "Run", "Rating", "Comment", "At"]}
          rows={PLACEHOLDER_AI_FEEDBACK.map((row) => [
            row.id,
            row.runId,
            row.rating,
            row.comment,
            row.at,
          ])}
        />
      ) : null}
      {section.key === "evaluations" ? (
        <SimpleTable
          columns={["Suite", "Score", "Passed", "Failed", "Ran"]}
          rows={PLACEHOLDER_AI_EVALUATIONS.map((row) => [
            row.suite,
            row.score,
            String(row.passed),
            String(row.failed),
            row.ranAt,
          ])}
        />
      ) : null}
      {section.key === "approvals" ? (
        <SimpleTable
          columns={["ID", "Tool", "Agent", "Risk", "Status", "Requested"]}
          rows={PLACEHOLDER_AI_APPROVALS.map((row) => [
            row.id,
            row.toolName,
            row.agent,
            row.risk,
            row.status,
            row.requestedAt,
          ])}
        />
      ) : null}
      {section.key === "failures" ? (
        <SimpleTable
          columns={["ID", "Agent", "Error", "At"]}
          rows={PLACEHOLDER_AI_FAILURES.map((row) => [
            row.id,
            row.agent,
            row.error,
            row.at,
          ])}
        />
      ) : null}
      {section.key === "security_events" ? (
        <>
          <section className="animate-rise rounded-2xl border border-[var(--color-danger)]/30 bg-red-50 p-4">
            <p className="font-mono text-sm text-[var(--color-danger)]">
              {FORBIDDEN_AI_PATHS[0]?.diagram}
            </p>
            <p className="text-muted mt-2 text-xs">{FORBIDDEN_AI_PATHS[0]?.reason}</p>
          </section>
          <SimpleTable
            columns={["ID", "Kind", "Detail", "At"]}
            rows={PLACEHOLDER_AI_SECURITY_EVENTS.map((row) => [
              row.id,
              row.kind,
              row.detail,
              row.at,
            ])}
          />
        </>
      ) : null}
      {section.key === "agents" ? null : (
        <p className="text-muted text-xs">
          Related runs sample: {PLACEHOLDER_AI_RUNS.length} placeholder runs on overview.
        </p>
      )}
    </>
  );
}

function AgentsPanel() {
  const specialists = listSpecialists();
  return (
    <div className="surface animate-rise rounded-2xl p-5">
      <p className="text-muted text-sm">
        Roster size: {AI_AGENT_ROSTER.length} (1 supervisor + {specialists.length} specialists).
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {AI_AGENT_ROSTER.map((agent) => (
          <li key={agent.code} className="rounded-xl border border-[var(--border)] p-3 text-sm">
            <p className="text-xs font-bold tracking-wide text-[var(--color-accent)] uppercase">
              {agent.tier.replaceAll("_", " ")}
            </p>
            <p className="mt-1 font-semibold">{agent.label}</p>
            <p className="text-muted mt-1 text-xs leading-relaxed">{agent.description}</p>
            <p className="text-muted mt-2 font-mono text-[11px]">{agent.code}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="surface animate-rise overflow-x-auto rounded-2xl">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-3 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-[var(--border)] last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={`${columns[cellIndex]}-${cell}`} className="px-3 py-3">
                  {columns[cellIndex] === "Status" ||
                  columns[cellIndex] === "Risk" ||
                  columns[cellIndex] === "Rating" ||
                  columns[cellIndex] === "Kind" ? (
                    <StatusPill label={cell} />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
