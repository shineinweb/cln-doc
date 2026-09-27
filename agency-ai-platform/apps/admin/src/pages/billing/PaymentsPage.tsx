import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_PAYMENTS } from "@/data/placeholders";

export function PaymentsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Payments"
        description="Payment attempts via PaymentProvider. Target API: GET /api/v1/admin/payments"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_PAYMENTS.map((payment) => (
              <tr key={payment.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{payment.invoiceNumber}</td>
                <td className="px-4 py-3">{payment.organization}</td>
                <td className="px-4 py-3">
                  <StatusPill label={payment.status} />
                </td>
                <td className="px-4 py-3">{formatMoney(payment.amountCents)}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{payment.provider}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
