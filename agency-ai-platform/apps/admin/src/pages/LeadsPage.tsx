import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_LEADS } from "@/data/placeholders";

export function LeadsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Leads"
        description="Inbound interest before qualification. Target API: GET /api/v1/admin/leads"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_LEADS.map((lead) => (
              <tr key={lead.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{lead.contactName}</p>
                  <p className="text-muted text-xs">{lead.email}</p>
                </td>
                <td className="px-4 py-3">{lead.companyName}</td>
                <td className="px-4 py-3">
                  <StatusPill label={lead.status} />
                </td>
                <td className="px-4 py-3">{lead.source}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{lead.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
