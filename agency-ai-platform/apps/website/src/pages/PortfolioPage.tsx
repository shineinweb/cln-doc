import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { Reveal } from "@/components/ui/Reveal";
import { PORTFOLIO } from "@/data/placeholders";

export function PortfolioPage() {
  return (
    <>
      <PageMeta
        title="Portfolio"
        description="Selected web, design, SEO, and AI projects."
        path="/portfolio"
      />
      <PageHero
        eyebrow="Portfolio"
        title="Work that looks sharp and ships clean."
        description="Case studies below use development placeholder imagery and summaries."
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {PORTFOLIO.map((item, index) => (
            <Reveal key={item.slug} delayMs={index * 60}>
              <article className="overflow-hidden rounded-2xl border border-[var(--border)]">
                <img
                  src={item.image}
                  alt={`${item.title} — development placeholder image`}
                  className="h-52 w-full object-cover"
                  loading="lazy"
                />
                <div className="surface border-0 p-5">
                  <p className="text-xs font-bold tracking-[0.12em] text-[var(--color-accent)] uppercase">
                    {item.category}
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-bold">{item.title}</h2>
                  <p className="text-muted mt-2 text-sm">{item.summary}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </>
  );
}
