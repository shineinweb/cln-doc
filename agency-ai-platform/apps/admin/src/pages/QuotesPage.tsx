import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_QUOTES } from "@/data/placeholders";

export function QuotesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Quotes"
        description="Formal proposals with line items. Target API: GET /api/v1/admin/quotes"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Number</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Project total</th>
              <th className="px-4 py-3 font-semibold">Monthly</th>
              <th className="px-4 py-3 font-semibold">Valid until</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_QUOTES.map((quote) => (
              <tr key={quote.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{quote.number}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{quote.title}</p>
                  {"lines" in quote && quote.lines.length > 0 ? (
                    <p className="text-muted mt-1 text-xs">{quote.lines.join(" · ")}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{quote.organization}</td>
                <td className="px-4 py-3">
                  <StatusPill label={quote.status} />
                </td>
                <td className="px-4 py-3">{formatMoney(quote.totalCents, quote.currency)}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">
                  {quote.monthlyCents != null
                    ? `${formatMoney(quote.monthlyCents, quote.currency)}/mo`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{quote.validUntil}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
