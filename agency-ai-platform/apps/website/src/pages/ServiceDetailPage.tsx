import { Navigate } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";

const DETAILS = {
  "web-development": {
    title: "Web Development",
    description: "Product-grade engineering for marketing sites, portals, and APIs.",
    points: [
      "Custom React / NestJS applications",
      "Integrations and automation",
      "Performance and accessibility baselines",
      "Handoff documentation and support",
    ],
  },
  "graphic-design": {
    title: "Graphic Design",
    description: "Visual systems that make brands unmistakable across web and print.",
    points: [
      "Brand identity and guidelines",
      "Marketing site art direction",
      "Campaign and social assets",
      "Design systems for product teams",
    ],
  },
  seo: {
    title: "SEO",
    description: "Technical SEO and content programs tied to measurable acquisition.",
    points: [
      "Technical audits and fixes",
      "Information architecture",
      "Content cluster planning",
      "Reporting you can act on",
    ],
  },
  "ai-development": {
    title: "AI Development",
    description: "Custom AI assistants with grounded knowledge and human approval paths.",
    points: [
      "Support and ops agents",
      "RAG over your knowledge base",
      "Tool calling with safeguards",
      "Evaluation and feedback loops",
    ],
  },
} as const;

export function ServiceDetailPage({ slug }: { slug: keyof typeof DETAILS }) {
  const detail = DETAILS[slug];
  if (!detail) return <Navigate to="/services" replace />;

  return (
    <>
      <PageMeta title={detail.title} description={detail.description} path={`/services/${slug}`} />
      <PageHero
        eyebrow="Service"
        title={detail.title}
        description={detail.description}
        actions={
          <>
            <ButtonLink to="/request-quote">Request quote</ButtonLink>
            <ButtonLink to="/portfolio" variant="ghost">
              See related work
            </ButtonLink>
          </>
        }
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <Reveal>
          <ul className="surface mt-6 grid gap-3 rounded-2xl p-6 text-sm sm:grid-cols-2">
            {detail.points.map((point) => (
              <li key={point} className="leading-relaxed">
                • {point}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </>
  );
}
