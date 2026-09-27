import { Link } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { KB_ARTICLES } from "@/data/placeholders";

export function KnowledgeBasePage() {
  return (
    <>
      <PageMeta
        title="Knowledge Base"
        description="Help articles for domains, hosting, and project kickoff."
        path="/knowledge-base"
      />
      <PageHero
        eyebrow="Knowledge Base"
        title="Answers you can skim before you open a ticket."
        description="Articles are development placeholders until knowledge content is published."
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {KB_ARTICLES.map((article, index) => (
            <Reveal key={article.slug} delayMs={index * 50}>
              <Link
                to={`/knowledge-base/${article.slug}`}
                className="surface block rounded-2xl p-5 no-underline"
              >
                <p className="text-xs font-bold tracking-[0.12em] uppercase">{article.category}</p>
                <h2 className="font-display mt-2 text-xl font-bold">{article.title}</h2>
                <p className="text-muted mt-2 text-sm">{article.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  );
}
