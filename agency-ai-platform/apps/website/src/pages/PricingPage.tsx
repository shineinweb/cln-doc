import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { HOSTING_PLANS } from "@/data/placeholders";

const SERVICE_PACKAGES = [
  {
    name: "Launch Site",
    price: "from $4,500",
    detail: "Marketing site, design system starter, SEO foundations.",
  },
  {
    name: "Product Build",
    price: "from $18,000",
    detail: "Custom app / portal scope with phased milestones.",
  },
  {
    name: "AI Assist",
    price: "from $8,000",
    detail: "Grounded assistant for support or internal ops.",
  },
] as const;

export function PricingPage() {
  return (
    <>
      <PageMeta
        title="Pricing"
        description="Transparent starting points for hosting and project packages."
        path="/pricing"
      />
      <PageHero
        eyebrow="Pricing"
        title="Clear starting numbers. Custom quotes when it matters."
        description="Hosting plans are listed below. Project packages are development placeholders — finalize via quote."
        actions={<ButtonLink to="/request-quote">Get a tailored quote</ButtonLink>}
      />
      <Container className="space-y-12 py-12">
        <PlaceholderBadge />
        <div>
          <h2 className="font-display text-2xl font-bold">Hosting</h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {HOSTING_PLANS.map((plan, index) => (
              <Reveal key={plan.id} delayMs={index * 50}>
                <article className="surface rounded-2xl p-5">
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                  <p className="mt-2 text-2xl font-bold">${plan.priceMonthly}/mo</p>
                  <p className="text-muted mt-2 text-sm">{plan.blurb}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">Project packages</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {SERVICE_PACKAGES.map((item, index) => (
              <Reveal key={item.name} delayMs={index * 50}>
                <article className="surface rounded-2xl p-5">
                  <h3 className="font-display text-xl font-bold">{item.name}</h3>
                  <p className="mt-2 font-semibold text-[var(--color-accent)]">{item.price}</p>
                  <p className="text-muted mt-2 text-sm">{item.detail}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </>
  );
}
