import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_CUSTOMERS } from "@/data/placeholders";

export function CustomersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Customers"
        description="Organizations with an active commercial relationship. Target API: GET /api/v1/admin/organizations (customers)"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Primary contact</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Projects</th>
              <th className="px-4 py-3 font-semibold">Recurring</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_CUSTOMERS.map((customer) => (
              <tr key={customer.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{customer.displayName}</p>
                  <p className="text-muted text-xs">{customer.email}</p>
                </td>
                <td className="px-4 py-3">{customer.primaryContact}</td>
                <td className="px-4 py-3">
                  <StatusPill label={customer.status} />
                </td>
                <td className="px-4 py-3">{customer.projects}</td>
                <td className="px-4 py-3 text-[var(--fg-muted)]">{customer.recurring}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
