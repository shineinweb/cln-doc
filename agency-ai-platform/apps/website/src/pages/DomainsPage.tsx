import { useState, type FormEvent } from "react";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";

export function DomainsPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;
    setResult(
      `Development placeholder: “${normalized}” would be checked via DomainProvider. No live registrar call is made.`,
    );
  }

  return (
    <>
      <PageMeta
        title="Domains"
        description="Search and register domains with DNS management."
        path="/domains"
      />
      <PageHero
        eyebrow="Domains"
        title="Claim the name. Wire the DNS. Ship."
        description="Domain search UI is ready — availability checks are stubbed until DomainProvider is connected."
        actions={<ButtonLink to="/request-quote">Need help transferring?</ButtonLink>}
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <form
          onSubmit={onSearch}
          className="surface mt-6 flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-end"
        >
          <label className="grid flex-1 gap-2 text-sm font-semibold">
            Domain search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="yourbrand.com"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Check availability
          </button>
        </form>
        {result ? <p className="text-muted mt-4 text-sm">{result}</p> : null}
      </Container>
    </>
  );
}
