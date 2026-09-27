import { WEBSITE_DEVELOPMENT_PACKAGE, formatUsdFromCents } from "@agency/shared";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { HOSTING_PLANS } from "@/data/placeholders";

const pkg = WEBSITE_DEVELOPMENT_PACKAGE;

export function PricingPage() {
  return (
    <>
      <PageMeta
        title="Pricing"
        description="Website Development package pricing — project total and monthly hosting plus maintenance."
        path="/pricing"
      />
      <PageHero
        eyebrow="Pricing"
        title="Website Development — clear numbers, no surprise scope."
        description="Development placeholder package below. Request a quote to tailor line items to your brief."
        actions={<ButtonLink to="/request-quote">Request this package</ButtonLink>}
      />
      <Container className="space-y-12 py-12">
        <PlaceholderBadge />

        <Reveal>
          <section className="surface overflow-hidden rounded-2xl">
            <div className="border-b border-[var(--border)] px-5 py-5 sm:px-8 sm:py-6">
              <p className="text-xs font-bold tracking-[0.14em] text-[var(--color-accent)] uppercase">
                Featured package
              </p>
              <h2 className="font-display mt-2 text-3xl font-bold tracking-tight">{pkg.name}</h2>
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr]">
              <div className="px-5 py-6 sm:px-8">
                <h3 className="text-xs font-bold tracking-[0.12em] text-[var(--fg-muted)] uppercase">
                  One-time
                </h3>
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {pkg.oneTimeLines.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-baseline justify-between gap-4 py-3 text-sm sm:text-base"
                    >
                      <span>{line.label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatUsdFromCents(line.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>

                <h3 className="mt-8 text-xs font-bold tracking-[0.12em] text-[var(--fg-muted)] uppercase">
                  Monthly
                </h3>
                <ul className="mt-4 divide-y divide-[var(--border)]">
                  {pkg.monthlyLines.map((line) => (
                    <li
                      key={line.key}
                      className="flex items-baseline justify-between gap-4 py-3 text-sm sm:text-base"
                    >
                      <span>{line.label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatUsdFromCents(line.amountCents, { monthly: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <aside className="border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--color-accent)_8%,var(--bg-elevated))] px-5 py-6 sm:px-8 lg:border-t-0 lg:border-l">
                <p className="text-xs font-bold tracking-[0.12em] uppercase">Project total</p>
                <p className="font-display mt-2 text-4xl font-extrabold tracking-tight tabular-nums">
                  {formatUsdFromCents(pkg.projectTotalCents)}
                </p>
                <p className="mt-6 text-xs font-bold tracking-[0.12em] uppercase">Monthly</p>
                <p className="font-display mt-2 text-3xl font-bold tracking-tight tabular-nums">
                  {formatUsdFromCents(pkg.monthlyTotalCents, { monthly: true })}
                </p>
                <p className="text-muted mt-4 text-sm leading-relaxed">
                  Hosting + maintenance after launch. Cancel or resize when your needs change.
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  <ButtonLink to="/request-quote">Request quote</ButtonLink>
                  <ButtonLink to="/services/web-development" variant="ghost">
                    Web development details
                  </ButtonLink>
                </div>
              </aside>
            </div>
          </section>
        </Reveal>

        <div>
          <h2 className="font-display text-2xl font-bold">Hosting plans</h2>
          <p className="text-muted mt-2 text-sm">
            Standalone hosting options — the Website Development package uses the $49/mo tier.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {HOSTING_PLANS.map((plan, index) => (
              <Reveal key={plan.id} delayMs={index * 50}>
                <article
                  className={`surface rounded-2xl p-5 ${
                    plan.highlighted ? "ring-2 ring-[var(--color-accent)]" : ""
                  }`}
                >
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-bold">${plan.priceMonthly}/mo</p>
                  <p className="text-muted mt-2 text-sm">{plan.blurb}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
