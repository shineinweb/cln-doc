import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_PRODUCTS } from "@/data/placeholders";

export function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Products"
        description="Sellable catalog items. Target API: GET /api/v1/admin/products"
      />
      <PlaceholderBadge />
      <div className="surface animate-rise overflow-x-auto rounded-2xl">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs tracking-wide text-[var(--fg-muted)] uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Key</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Default price</th>
            </tr>
          </thead>
          <tbody>
            {PLACEHOLDER_PRODUCTS.map((product) => (
              <tr key={product.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{product.key}</td>
                <td className="px-4 py-3 font-semibold">{product.name}</td>
                <td className="px-4 py-3">
                  <StatusPill label={product.type} />
                </td>
                <td className="px-4 py-3">{product.priceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
