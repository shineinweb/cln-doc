import { Link } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SERVICES } from "@/data/placeholders";

export function ServicesPage() {
  return (
    <>
      <PageMeta
        title="Services"
        description="Web programming, design, SEO, AI development, hosting, and domains."
        path="/services"
      />
      <PageHero
        eyebrow="Services"
        title="A complete digital stack — engineered to convert."
        description="Choose a capability or combine them into one delivery plan with clear ownership."
        actions={<ButtonLink to="/request-quote">Start a project</ButtonLink>}
      />
      <Container className="grid gap-4 py-12 sm:grid-cols-2">
        {SERVICES.map((service, index) => (
          <Reveal key={service.slug} delayMs={index * 50}>
            <Link
              to={service.path}
              className="surface block rounded-2xl p-6 no-underline transition-transform hover:-translate-y-0.5"
            >
              <h2 className="font-display text-2xl font-bold">{service.title}</h2>
              <p className="text-muted mt-2 text-sm leading-relaxed">{service.summary}</p>
            </Link>
          </Reveal>
        ))}
      </Container>
    </>
  );
}
