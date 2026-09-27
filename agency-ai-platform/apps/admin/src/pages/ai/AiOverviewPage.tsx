import {
  ADMIN_AI_SECTIONS,
  AI_AGENT_ROSTER,
  AI_ORG_CHART,
  APPROVAL_PIPELINE,
  CODING_PIPELINE_DIAGRAM,
  FORBIDDEN_AI_PATHS,
  HOSTING_PIPELINE_DIAGRAM,
  KNOWLEDGE_PIPELINE_DIAGRAM,
  listSpecialists,
} from "@agency/ai";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_AI_APPROVALS, PLACEHOLDER_AI_RUNS } from "@/data/placeholders";

export function AiOverviewPage() {
  const specialists = listSpecialists();

  return (
    <>
      <PageHeader
        title="AI"
        description="Supervisor roster, approval queue, and delivery pipelines. Target API: GET /api/v1/admin/ai/*"
      />
      <PlaceholderBadge />

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">Management sections</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_AI_SECTIONS.map((section) => (
            <li key={section.key}>
              <Link
                to={`/admin/ai/${section.path}`}
                className="block rounded-xl border border-[var(--border)] p-3 text-sm no-underline transition-colors hover:border-[var(--color-accent)]"
              >
                <p className="font-semibold text-[var(--fg)]">{section.label}</p>
                <p className="text-muted mt-1 text-xs leading-relaxed">{section.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">AI Supervisor</h2>
        <p className="text-muted mt-1 text-sm">
          {AI_AGENT_ROSTER.find((agent) => agent.code === "supervisor")?.description}
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-[var(--color-sidebar)] p-4 font-mono text-[11px] leading-relaxed text-slate-100 whitespace-pre">
          {AI_ORG_CHART}
        </pre>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {specialists.map((agent) => (
            <li
              key={agent.code}
              className="rounded-xl border border-[var(--border)] p-3 text-sm"
            >
              <p className="text-xs font-bold tracking-wide text-[var(--color-accent)] uppercase">
                {agent.tier.replaceAll("_", " ")}
              </p>
              <p className="mt-1 font-semibold">{agent.label}</p>
              <p className="text-muted mt-1 text-xs leading-relaxed">{agent.description}</p>
              <p className="text-muted mt-2 text-[11px]">
                {agent.toolAllowlist.length} tools allowlisted
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Approval queue</h2>
            <p className="text-muted mt-1 text-sm">
              {APPROVAL_PIPELINE.map((step) => step.label).join(" → ")}
            </p>
          </div>
          <Link
            to="/admin/ai/approvals"
            className="text-sm font-semibold text-[var(--color-accent)] no-underline hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-2 py-3 font-semibold">Tool</th>
                <th className="px-2 py-3 font-semibold">Agent</th>
                <th className="px-2 py-3 font-semibold">Risk</th>
                <th className="px-2 py-3 font-semibold">Status</th>
                <th className="px-2 py-3 font-semibold">Requested</th>
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_AI_APPROVALS.map((item) => (
                <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-2 py-3 font-semibold">{item.toolName}</td>
                  <td className="px-2 py-3">{item.agent}</td>
                  <td className="px-2 py-3">
                    <StatusPill label={item.risk} />
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill label={item.status} />
                  </td>
                  <td className="px-2 py-3 text-[var(--fg-muted)]">{item.requestedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">Recent runs</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
              <tr>
                <th className="px-2 py-3 font-semibold">Run</th>
                <th className="px-2 py-3 font-semibold">Agent</th>
                <th className="px-2 py-3 font-semibold">Status</th>
                <th className="px-2 py-3 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_AI_RUNS.map((run) => (
                <tr key={run.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-2 py-3 font-mono text-xs">{run.id}</td>
                  <td className="px-2 py-3">{run.agent}</td>
                  <td className="px-2 py-3">
                    <StatusPill label={run.status} />
                  </td>
                  <td className="px-2 py-3 text-[var(--fg-muted)]">{run.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PipelineCard title="Coding delivery" diagram={CODING_PIPELINE_DIAGRAM} />
        <PipelineCard title="Hosting diagnostics" diagram={HOSTING_PIPELINE_DIAGRAM} />
        <PipelineCard title="Knowledge capture" diagram={KNOWLEDGE_PIPELINE_DIAGRAM} />
      </section>

      <section className="animate-rise rounded-2xl border border-[var(--color-danger)]/30 bg-red-50 p-5">
        <h2 className="font-display text-lg font-bold text-[var(--color-danger)]">
          Forbidden path
        </h2>
        <p className="mt-2 font-mono text-sm text-[var(--color-danger)]">
          {FORBIDDEN_AI_PATHS[0]?.diagram}
        </p>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          {FORBIDDEN_AI_PATHS[0]?.reason}
        </p>
      </section>
    </>
  );
}

function PipelineCard({ title, diagram }: { title: string; diagram: string }) {
  return (
    <div className="surface animate-rise rounded-2xl p-4">
      <h3 className="font-display text-base font-bold">{title}</h3>
      <pre className="text-muted mt-3 overflow-x-auto font-mono text-[10px] leading-relaxed whitespace-pre">
        {diagram}
      </pre>
    </div>
  );
}
