import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_WEBHOOKS } from "@/data/placeholders";

export function WebhooksPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Webhooks"
        description="Idempotent PaymentProvider webhook inbox. Target: POST /api/v1/webhooks/stripe"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">External id</th>
              <th className="px-4 py-3 font-semibold">Received</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_WEBHOOKS.map((event) => (
              <tr key={event.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">{event.provider}</td>
                <td className="px-4 py-3 font-semibold">{event.eventType}</td>
                <td className="px-4 py-3">
                  <StatusPill label={event.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{event.externalId}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{event.receivedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
