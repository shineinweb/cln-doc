/**
 * DEVELOPMENT PLACEHOLDER — sample sellable packages.
 * Replace with ServiceCatalog / CMS data before production.
 */

export const WEBSITE_DEVELOPMENT_PACKAGE = {
  id: "website-development",
  name: "Website Development",
  currency: "USD",
  oneTimeLines: [
    { key: "ui-ux-design", label: "UI/UX Design", amountCents: 250_000 },
    { key: "development", label: "Development", amountCents: 600_000 },
    { key: "seo-setup", label: "SEO Setup", amountCents: 100_000 },
  ],
  monthlyLines: [
    { key: "hosting", label: "Hosting", amountCents: 4_900, interval: "month" as const },
    {
      key: "maintenance",
      label: "Maintenance",
      amountCents: 19_900,
      interval: "month" as const,
    },
  ],
  /** One-time project total: $9,500 */
  projectTotalCents: 950_000,
  /** Recurring monthly total: $248 */
  monthlyTotalCents: 24_800,
} as const;

export type WebsiteDevelopmentPackage = typeof WEBSITE_DEVELOPMENT_PACKAGE;

export function formatUsdFromCents(cents: number, opts?: { monthly?: boolean }): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return opts?.monthly ? `${formatted}/mo` : formatted;
}
