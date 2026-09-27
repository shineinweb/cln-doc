import { useState, type FormEvent } from "react";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { SERVICES } from "@/data/placeholders";

export function RequestQuotePage() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <PageMeta
        title="Request Quote"
        description="Request a project quote from Agency AI."
        path="/request-quote"
      />
      <PageHero
        eyebrow="Request quote"
        title="Share the brief. We will shape the plan."
        description="This form is conversion-ready UI with development placeholder submit behavior — wire to the API when quote intake ships."
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <form onSubmit={onSubmit} className="surface mt-6 grid max-w-2xl gap-4 rounded-2xl p-6">
          <label className="grid gap-2 text-sm font-semibold">
            Name
            <input
              required
              name="name"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Work email
            <input
              required
              type="email"
              name="email"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Company
            <input
              required
              name="company"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Interested in</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICES.map((service) => (
                <label key={service.slug} className="flex items-center gap-2 text-sm font-normal">
                  <input type="checkbox" name="services" value={service.slug} />
                  {service.title}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-2 text-sm font-semibold">
            Project summary
            <textarea
              required
              name="summary"
              rows={5}
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Budget range (optional)
            <select
              name="budget"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
              defaultValue=""
            >
              <option value="" disabled>
                Select a range
              </option>
              <option value="under-10k">Under $10k</option>
              <option value="10-40k">$10k–$40k</option>
              <option value="40k-plus">$40k+</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Submit quote request
          </button>
          {submitted ? (
            <p className="text-sm text-[var(--color-accent-strong)]" role="status">
              Development placeholder: quote request kept in the browser only — no API integration.
            </p>
          ) : null}
        </form>
      </Container>
    </>
  );
}
