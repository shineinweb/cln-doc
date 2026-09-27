import { REFUND_WORKFLOW } from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_REFUNDS } from "@/data/placeholders";

export function RefundsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Refunds"
        description="Refund workflow: Requested → Pending approval → Approved → Processing → Succeeded."
      />
      <PlaceholderBadge />
      <ol className="surface grid gap-2 rounded-2xl p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {REFUND_WORKFLOW.map((step, index) => (
          <li key={step.status} className="rounded-xl border border-[var(--border)] p-3">
            <p className="text-xs font-bold text-[var(--color-accent)]">
              {index + 1}. {step.label}
            </p>
            <p className="text-muted mt-1 text-xs">{step.description}</p>
          </li>
        ))}
      </ol>
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Payment</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_REFUNDS.map((refund) => (
              <tr key={refund.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{refund.paymentId}</td>
                <td className="px-4 py-3">{refund.organization}</td>
                <td className="px-4 py-3">
                  <StatusPill label={refund.status} />
                </td>
                <td className="px-4 py-3">{formatMoney(refund.amountCents)}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{refund.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
