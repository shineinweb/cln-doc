import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { PLACEHOLDER_TODAY_DASHBOARD } from "@/data/placeholders";

export function DashboardPage() {
  const dash = PLACEHOLDER_TODAY_DASHBOARD;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Today"
        description="Agency ops snapshot — revenue, pipeline, projects, hosting, and AI. Target API: GET /api/v1/admin/dashboard"
      />
      <PlaceholderBadge />

      <section className="surface animate-rise overflow-hidden rounded-2xl">
        <header className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase">
            Today
          </h2>
        </header>
        <dl className="divide-y divide-[var(--border)]">
          {dash.today.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm"
            >
              <dt className="text-[var(--fg-muted)]">{row.label}</dt>
              <dd className="font-display text-right text-lg font-bold tracking-tight">
                <Link to={row.to} className="text-[var(--fg)] no-underline hover:text-[var(--color-accent)]">
                  {row.value}
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase">
          Sales pipeline
        </h2>
        <ol className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {dash.salesPipeline.map((stage, index) => (
            <li key={stage.label} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="text-[var(--fg-muted)]" aria-hidden>
                  →
                </span>
              ) : null}
              <Link
                to={stage.to}
                className="rounded-xl border border-[var(--border)] px-3 py-2 no-underline transition-colors hover:border-[var(--color-accent)]"
              >
                <span className="font-semibold text-[var(--fg)]">{stage.label}</span>
                <span className="ml-2 font-display text-lg font-bold text-[var(--color-accent)]">
                  {stage.value}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase">
          Projects
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {dash.projects.map((stage) => (
            <li
              key={stage.label}
              className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
            >
              <p className="text-[var(--fg-muted)]">{stage.label}</p>
              <p className="font-display mt-1 text-2xl font-bold">{stage.value}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase">
          Hosting
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {dash.hosting.map((item) => (
            <li
              key={item.label}
              className="rounded-xl border border-[var(--border)] px-3 py-3 text-sm"
            >
              <p className="text-[var(--fg-muted)]">{item.label}</p>
              <p
                className={`font-display mt-1 text-2xl font-bold ${
                  item.label === "Alerts" && Number(item.value) > 0
                    ? "text-[var(--color-danger)]"
                    : ""
                }`}
              >
                {item.value}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface animate-rise rounded-2xl p-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xs font-bold tracking-[0.16em] text-[var(--color-accent)] uppercase">
            AI
          </h2>
          <Link
            to="/admin/ai"
            className="text-sm font-semibold text-[var(--color-accent)] no-underline hover:underline"
          >
            Open AI console
          </Link>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {dash.ai.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                className="block rounded-xl border border-[var(--border)] px-3 py-3 text-sm no-underline transition-colors hover:border-[var(--color-accent)]"
              >
                <p className="text-[var(--fg-muted)]">{item.label}</p>
                <p className="font-display mt-1 text-2xl font-bold text-[var(--fg)]">
                  {item.value}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
