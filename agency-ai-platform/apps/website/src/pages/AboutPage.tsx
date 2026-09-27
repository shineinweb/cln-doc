import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { COMPANY } from "@/data/placeholders";

export function AboutPage() {
  return (
    <>
      <PageMeta
        title="About"
        description="Meet Agency AI — digital products, infrastructure, and intelligence."
        path="/about"
      />
      <PageHero
        eyebrow="About"
        title={`${COMPANY.name} builds systems brands can trust.`}
        description="We combine product engineering, design, SEO, hosting, and AI so you are not juggling five vendors."
        actions={<ButtonLink to="/contact">Contact us</ButtonLink>}
      />
      <Container className="space-y-6 py-12">
        <PlaceholderBadge />
        <Reveal>
          <div className="surface rounded-2xl p-6 text-sm leading-relaxed sm:p-8">
            <p>
              {COMPANY.name} is a development-stage company profile for this platform. Replace this
              narrative with your founding story, leadership, and delivery principles before launch.
            </p>
            <p className="text-muted mt-4">
              We care about conversion-minded design, accessible interfaces, and infrastructure that
              stays quiet — with AI assistants that respect approval boundaries.
            </p>
          </div>
        </Reveal>
      </Container>
    </>
  );
}
