import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_INVOICES } from "@/data/placeholders";

export function InvoicesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Invoices"
        description="Customer invoices. Target API: GET /api/v1/admin/invoices"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Number</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Paid</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_INVOICES.map((invoice) => (
              <tr key={invoice.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{invoice.number}</td>
                <td className="px-4 py-3">{invoice.organization}</td>
                <td className="px-4 py-3">
                  <StatusPill label={invoice.status} />
                </td>
                <td className="px-4 py-3">{formatMoney(invoice.totalCents)}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">
                  {formatMoney(invoice.amountPaidCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
