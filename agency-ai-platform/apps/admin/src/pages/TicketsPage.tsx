import { SUPPORT_TICKET_STATUS_PIPELINE } from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_TICKETS } from "@/data/placeholders";

export function TicketsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Tickets"
        description="Support tickets — SupportTicket → messages, attachments, assignments, status history. Target API: GET /api/v1/admin/tickets"
      />
      <PlaceholderBadge />
      <section className="surface animate-rise rounded-2xl p-5">
        <h2 className="font-display text-lg font-bold">Status pipeline</h2>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUPPORT_TICKET_STATUS_PIPELINE.map((step, index) => (
            <li key={step.status} className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <p className="text-xs font-bold text-[var(--color-accent)]">
                {index + 1}. {step.label}
              </p>
              <p className="text-muted mt-1 text-xs leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">#</th>
              <th className="px-4 py-3 font-semibold">Subject</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Priority</th>
              <th className="px-4 py-3 font-semibold">Assignee</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_TICKETS.map((ticket) => (
              <tr key={ticket.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-semibold">{ticket.number}</td>
                <td className="px-4 py-3">{ticket.subject}</td>
                <td className="px-4 py-3">{ticket.customer}</td>
                <td className="px-4 py-3">
                  <StatusPill label={ticket.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill label={ticket.priority} />
                </td>
                <td className="px-4 py-3">{ticket.assignee}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{ticket.updatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
