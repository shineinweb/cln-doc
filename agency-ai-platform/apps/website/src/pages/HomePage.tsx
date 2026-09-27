import { Link } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WEBSITE_DEVELOPMENT_PACKAGE, formatUsdFromCents } from "@agency/shared";
import { COMPANY, HOSTING_PLANS, PORTFOLIO, SERVICES } from "@/data/placeholders";

export function HomePage() {
  return (
    <>
      <PageMeta
        title={COMPANY.name}
        description="Web programming, design, SEO, hosting, domains, and AI development for ambitious brands."
        path="/"
      />

      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="hero-media absolute inset-0" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/25" />
        <Container className="relative flex min-h-[100svh] flex-col justify-end pb-16 pt-28 text-white sm:pb-20">
          <p className="animate-fade font-display text-sm font-bold tracking-[0.18em] uppercase">
            {COMPANY.name}
          </p>
          <h1 className="font-display animate-rise mt-3 max-w-3xl text-5xl leading-[0.98] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Build the digital system your brand can grow on.
          </h1>
          <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-white/85 [animation-delay:90ms]">
            Web, design, SEO, hosting, domains, and custom AI — one accountable partner.
          </p>
          <div className="animate-rise mt-8 flex flex-wrap gap-3 [animation-delay:150ms]">
            <ButtonLink to="/request-quote" variant="inverse">
              Request a quote
            </ButtonLink>
            <ButtonLink
              to="/services"
              variant="ghost"
              className="border-white/35 text-white hover:border-white"
            >
              Explore services
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Capabilities"
              title="Everything between idea and reliable operations."
              description="From product engineering to managed infrastructure — designed for clarity and conversion."
            />
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, index) => (
              <Reveal key={service.slug} delayMs={index * 60}>
                <Link
                  to={service.path}
                  className="surface block rounded-2xl p-5 no-underline transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <h3 className="font-display text-xl font-bold">{service.title}</h3>
                  <p className="text-muted mt-2 text-sm leading-relaxed">{service.summary}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Selected work"
              title="Proof in shipped products."
              description="Portfolio entries below use development placeholder imagery and copy."
            />
          </Reveal>
          <PlaceholderBadge className="mt-4" />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {PORTFOLIO.slice(0, 2).map((item, index) => (
              <Reveal key={item.slug} delayMs={index * 80}>
                <article className="overflow-hidden rounded-2xl border border-[var(--border)]">
                  <img
                    src={item.image}
                    alt={`${item.title} — development placeholder image`}
                    className="h-56 w-full object-cover"
                    loading="lazy"
                  />
                  <div className="surface border-0 p-5">
                    <p className="text-xs font-bold tracking-[0.12em] text-[var(--color-accent)] uppercase">
                      {item.category}
                    </p>
                    <h3 className="font-display mt-2 text-2xl font-bold">{item.title}</h3>
                    <p className="text-muted mt-2 text-sm">{item.summary}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
          <div className="mt-8">
            <ButtonLink to="/portfolio" variant="ghost">
              View portfolio
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Pricing"
              title="Website Development, priced in plain numbers."
              description={`${formatUsdFromCents(WEBSITE_DEVELOPMENT_PACKAGE.projectTotalCents)} project · ${formatUsdFromCents(WEBSITE_DEVELOPMENT_PACKAGE.monthlyTotalCents, { monthly: true })} hosting + maintenance.`}
            />
          </Reveal>
          <Reveal delayMs={60}>
            <div className="surface mt-8 grid gap-4 rounded-2xl p-6 sm:grid-cols-3">
              {WEBSITE_DEVELOPMENT_PACKAGE.oneTimeLines.map((line) => (
                <div key={line.key}>
                  <p className="text-muted text-xs font-bold tracking-[0.12em] uppercase">
                    {line.label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">
                    {formatUsdFromCents(line.amountCents)}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
          <div className="mt-8">
            <ButtonLink to="/pricing">See full pricing</ButtonLink>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Hosting"
              title="Plans that stay out of the way."
              description="Transparent starting points — finalize commercial terms during quote."
            />
          </Reveal>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {HOSTING_PLANS.map((plan, index) => (
              <Reveal key={plan.id} delayMs={index * 70}>
                <div
                  className={`surface rounded-2xl p-6 ${
                    plan.highlighted ? "ring-2 ring-[var(--color-accent)]" : ""
                  }`}
                >
                  <h3 className="font-display text-2xl font-bold">{plan.name}</h3>
                  <p className="mt-3 text-3xl font-bold">
                    ${plan.priceMonthly}
                    <span className="text-muted text-sm font-medium">/mo</span>
                  </p>
                  <p className="text-muted mt-3 text-sm">{plan.blurb}</p>
                  <ul className="mt-5 grid gap-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature}>• {feature}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink to="/pricing">See pricing</ButtonLink>
            <ButtonLink to="/hosting" variant="ghost">
              Hosting details
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
