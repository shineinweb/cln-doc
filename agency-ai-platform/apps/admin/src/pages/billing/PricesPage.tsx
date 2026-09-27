import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, PLACEHOLDER_PRICES } from "@/data/placeholders";

export function PricesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Prices"
        description="Priced SKUs for products. Target API: GET /api/v1/admin/prices"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Key</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Interval</th>
              <th className="px-4 py-3 font-semibold">Unit</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_PRICES.map((price) => (
              <tr key={price.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{price.key}</td>
                <td className="px-4 py-3 font-semibold">{price.product}</td>
                <td className="px-4 py-3">
                  <StatusPill label={price.interval} />
                </td>
                <td className="px-4 py-3">
                  {formatMoney(price.unitCents)}
                  {price.interval === "MONTHLY" ? "/mo" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
