import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { HOSTING_PLANS } from "@/data/placeholders";

export function HostingPage() {
  return (
    <>
      <PageMeta
        title="Hosting"
        description="Web hosting and managed hosting with proactive operations."
        path="/hosting"
      />
      <PageHero
        eyebrow="Hosting"
        title="Infrastructure that stays boring — on purpose."
        description="Shared, growth, and managed options with SSL, backups, and clear escalation paths."
        actions={<ButtonLink to="/request-quote">Talk hosting</ButtonLink>}
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {HOSTING_PLANS.map((plan, index) => (
            <Reveal key={plan.id} delayMs={index * 60}>
              <article className="surface rounded-2xl p-6">
                <h2 className="font-display text-2xl font-bold">{plan.name}</h2>
                <p className="mt-3 text-3xl font-bold">${plan.priceMonthly}/mo</p>
                <p className="text-muted mt-3 text-sm">{plan.blurb}</p>
                <ul className="mt-5 grid gap-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  );
}
