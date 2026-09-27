import type { ReactNode } from "react";
import { Container } from "@/components/ui/Container";

/** Interior page hero — compact, not competing with the home full-bleed hero. */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--border)] py-14 sm:py-16">
      <Container>
        {eyebrow ? (
          <p className="animate-fade mb-3 text-xs font-bold tracking-[0.14em] text-[var(--color-accent)] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display animate-rise max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted animate-rise mt-4 max-w-2xl text-lg leading-relaxed [animation-delay:80ms]">
          {description}
        </p>
        {actions ? (
          <div className="animate-rise mt-7 flex flex-wrap gap-3 [animation-delay:140ms]">
            {actions}
          </div>
        ) : null}
      </Container>
    </section>
  );
}
