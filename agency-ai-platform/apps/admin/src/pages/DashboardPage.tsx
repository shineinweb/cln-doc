import { Link } from "react-router-dom";
import { COMMERCIAL_LIFECYCLE } from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import {
  PLACEHOLDER_CUSTOMERS,
  PLACEHOLDER_LEADS,
  PLACEHOLDER_OPPORTUNITIES,
  PLACEHOLDER_QUOTES,
} from "@/data/placeholders";

const COUNTS = [
  { label: "Leads", to: "/admin/leads", value: PLACEHOLDER_LEADS.length },
  {
    label: "Opportunities",
    to: "/admin/opportunities",
    value: PLACEHOLDER_OPPORTUNITIES.length,
  },
  { label: "Quotes", to: "/admin/quotes", value: PLACEHOLDER_QUOTES.length },
  { label: "Customers", to: "/admin/customers", value: PLACEHOLDER_CUSTOMERS.length },
] as const;

export function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title="Dashboard"
        description="Commercial lifecycle overview — Lead through Recurring Services."
      />
      <PlaceholderBadge />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COUNTS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="surface animate-rise block rounded-2xl p-5 no-underline transition-transform hover:-translate-y-0.5"
          >
            <p className="text-muted text-xs font-bold tracking-[0.12em] uppercase">{item.label}</p>
            <p className="font-display mt-2 text-3xl font-bold">{item.value}</p>
          </Link>
        ))}
      </div>
      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-xl font-bold">Lifecycle</h2>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {COMMERCIAL_LIFECYCLE.map((step, index) => (
            <li key={step.stage} className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <p className="text-xs font-bold text-[var(--color-accent)]">
                {index + 1}. {step.label}
              </p>
              <p className="text-muted mt-1 text-xs leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
