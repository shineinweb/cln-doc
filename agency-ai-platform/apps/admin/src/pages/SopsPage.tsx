import {
  AGENCY_SOPS,
  SOP_CATEGORIES,
  SOP_CATEGORY_LABELS,
  formatSopLabel,
  listSopsByCategory,
} from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";

export function SopsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="SOPs"
        description={`${AGENCY_SOPS.length} standard operating procedures (SOP-001 … SOP-030). Source: @agency/shared AGENCY_SOPS · docs/SOPS.md`}
      />
      <PlaceholderBadge />

      {SOP_CATEGORIES.map((category) => {
        const sops = listSopsByCategory(category);
        return (
          <section key={category} className="surface animate-rise rounded-2xl p-5">
            <h2 className="font-display text-lg font-bold">{SOP_CATEGORY_LABELS[category]}</h2>
            <p className="text-muted mt-1 text-xs">{sops.length} procedures</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {sops.map((sop) => (
                <li key={sop.code} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                  <p className="font-mono text-xs font-bold text-[var(--color-accent)]">
                    {sop.code}
                  </p>
                  <p className="mt-1 font-semibold">{sop.title}</p>
                  <p className="sr-only">{formatSopLabel(sop)}</p>
                  <p className="text-muted mt-1 text-xs leading-relaxed">{sop.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
