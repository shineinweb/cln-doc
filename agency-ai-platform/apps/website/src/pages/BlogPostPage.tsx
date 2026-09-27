import { Link, Navigate, useParams } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { BLOG_POSTS } from "@/data/placeholders";

export function BlogPostPage() {
  const { slug } = useParams();
  const post = BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) return <Navigate to="/blog" replace />;

  return (
    <>
      <PageMeta title={post.title} description={post.excerpt} path={`/blog/${post.slug}`} />
      <Container className="py-14">
        <Link to="/blog" className="text-sm font-semibold text-[var(--color-accent)]">
          ← Blog
        </Link>
        <p className="mt-6 text-xs font-bold tracking-[0.12em] text-[var(--color-accent)] uppercase">
          {post.tag} · {post.date}
        </p>
        <h1 className="font-display mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-balance">
          {post.title}
        </h1>
        <PlaceholderBadge className="mt-5" />
        <article className="surface mt-6 max-w-3xl rounded-2xl p-6 text-sm leading-relaxed sm:p-8">
          <p>{post.excerpt}</p>
          <p className="text-muted mt-4">
            Full article body is a development placeholder. Connect the CMS or MDX pipeline to
            publish real posts.
          </p>
        </article>
      </Container>
    </>
  );
}
