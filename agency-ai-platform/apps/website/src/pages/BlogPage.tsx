import { Link } from "react-router-dom";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { BLOG_POSTS } from "@/data/placeholders";

export function BlogPage() {
  return (
    <>
      <PageMeta
        title="Blog"
        description="Notes on engineering, AI, SEO, and hosting."
        path="/blog"
      />
      <PageHero
        eyebrow="Blog"
        title="Field notes from shipping digital systems."
        description="Articles are development placeholders until the CMS is connected."
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <div className="mt-6 grid gap-4">
          {BLOG_POSTS.map((post, index) => (
            <Reveal key={post.slug} delayMs={index * 50}>
              <Link
                to={`/blog/${post.slug}`}
                className="surface block rounded-2xl p-5 no-underline transition-transform hover:-translate-y-0.5"
              >
                <p className="text-xs font-bold tracking-[0.12em] text-[var(--color-accent)] uppercase">
                  {post.tag} · {post.date}
                </p>
                <h2 className="font-display mt-2 text-2xl font-bold">{post.title}</h2>
                <p className="text-muted mt-2 text-sm">{post.excerpt}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  );
}
