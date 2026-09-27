import { useState, type FormEvent } from "react";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { COMPANY } from "@/data/placeholders";

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <PageMeta title="Contact" description="Contact Agency AI." path="/contact" />
      <PageHero
        eyebrow="Contact"
        title="Tell us what you are building."
        description={`${COMPANY.email} · ${COMPANY.phone}. Form submissions are local placeholders — not sent to an API.`}
      />
      <Container className="py-12">
        <PlaceholderBadge />
        <form onSubmit={onSubmit} className="surface mt-6 grid max-w-xl gap-4 rounded-2xl p-6">
          <label className="grid gap-2 text-sm font-semibold">
            Name
            <input
              required
              name="name"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              required
              type="email"
              name="email"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Message
            <textarea
              required
              name="message"
              rows={5}
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Send message
          </button>
          {submitted ? (
            <p className="text-sm text-[var(--color-accent-strong)]" role="status">
              Development placeholder: message captured in UI only — no backend call.
            </p>
          ) : null}
        </form>
      </Container>
    </>
  );
}
