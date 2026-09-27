import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_OPPORTUNITIES } from "@/data/placeholders";

export function OpportunitiesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Opportunities"
        description="Qualified pipeline deals. Target API: GET /api/v1/admin/opportunities"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Opportunity</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Expected close</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_OPPORTUNITIES.map((opportunity) => (
              <tr key={opportunity.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{opportunity.name}</td>
                <td className="px-4 py-3">
                  <StatusPill label={opportunity.stage} />
                </td>
                <td className="px-4 py-3">
                  {formatMoney(opportunity.amountCents, opportunity.currency)}
                </td>
                <td className="px-4 py-3">{opportunity.owner}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{opportunity.expectedClose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
