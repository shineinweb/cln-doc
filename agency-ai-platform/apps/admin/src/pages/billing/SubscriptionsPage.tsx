import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_SUBSCRIPTIONS } from "@/data/placeholders";

export function SubscriptionsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Recurring services. Target API: GET /api/v1/admin/subscriptions"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Organization</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_SUBSCRIPTIONS.map((subscription) => (
              <tr key={subscription.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{subscription.name}</td>
                <td className="px-4 py-3">{subscription.organization}</td>
                <td className="px-4 py-3">
                  <StatusPill label={subscription.status} />
                </td>
                <td className="px-4 py-3">
                  {formatMoney(subscription.amountCents)}
                  {subscription.interval === "MONTHLY" ? "/mo" : "/yr"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
