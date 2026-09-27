import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PLACEHOLDER_NOTICE } from "../data/placeholders";

export function AskAiPage() {
  const [params] = useSearchParams();
  const initial = params.get("q")?.trim() ?? "";
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <section className="portal-page animate-rise">
      <div className="portal-page__header">
        <p className="portal-page__eyebrow">AI Support</p>
        <h1 className="portal-page__title">Ask AI</h1>
        <p className="portal-page__lede">
          Customer-scoped Support AI — answers use your account tools and knowledge base.
        </p>
        <p className="placeholder-badge">{PLACEHOLDER_NOTICE}</p>
      </div>

      <form className="dash-ask dash-ask--page" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="ask-ai-input">
          Ask AI about your account
        </label>
        <input
          id="ask-ai-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ask AI anything about your account..."
          autoComplete="off"
        />
        <button type="submit" className="dash-ask__submit">
          Ask AI
        </button>
      </form>

      {submitted ? (
        <div className="ask-ai-reply">
          <p className="ask-ai-reply__label">You asked</p>
          <p className="ask-ai-reply__q">“{submitted}”</p>
          <p className="ask-ai-reply__a">
            AI reply is PLACEHOLDER until Nest binds `POST /api/v1/ai/complete` for portal
            sessions. Hosting diagnostics and ticket tools will run under the Support agent.
          </p>
          <Link className="hosting-cta hosting-cta--ghost" to="/tickets/new">
            Open a ticket instead
          </Link>
        </div>
      ) : null}
    </section>
  );
}
