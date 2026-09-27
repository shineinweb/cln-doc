import { Link, Navigate, useParams } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { KB_ARTICLES } from "@/data/placeholders";

export function KnowledgeArticlePage() {
  const { slug } = useParams();
  const article = KB_ARTICLES.find((item) => item.slug === slug);
  if (!article) return <Navigate to="/knowledge-base" replace />;

  return (
    <>
      <PageMeta
        title={article.title}
        description={article.excerpt}
        path={`/knowledge-base/${article.slug}`}
      />
      <Container className="py-14">
        <Link to="/knowledge-base" className="text-sm font-semibold text-[var(--color-accent)]">
          ← Knowledge Base
        </Link>
        <h1 className="font-display mt-6 max-w-3xl text-4xl font-extrabold tracking-tight">
          {article.title}
        </h1>
        <PlaceholderBadge className="mt-5" />
        <article className="surface mt-6 max-w-3xl rounded-2xl p-6 text-sm leading-relaxed sm:p-8">
          <p>{article.excerpt}</p>
          <p className="text-muted mt-4">
            Detailed steps are a development placeholder. Publish runbooks from the admin knowledge
            module when ready.
          </p>
        </article>
      </Container>
    </>
  );
}
