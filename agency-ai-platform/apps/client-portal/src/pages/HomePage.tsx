import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PLACEHOLDER_DASHBOARD, PLACEHOLDER_NOTICE } from "../data/placeholders";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const dash = PLACEHOLDER_DASHBOARD;

  function onAsk(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    void navigate(q ? `/ai?q=${encodeURIComponent(q)}` : "/ai");
  }

  return (
    <section className="dash animate-rise" aria-label="Customer dashboard">
      <p className="placeholder-badge">{PLACEHOLDER_NOTICE}</p>

      <div className="dash-panel">
        <header className="dash-panel__welcome">
          <h1 className="dash-panel__title">Welcome back</h1>
          {user ? <p className="dash-panel__user">{user.name}</p> : null}
          <form className="dash-ask" onSubmit={onAsk}>
            <label className="sr-only" htmlFor="dash-ask-ai">
              Ask AI about your account
            </label>
            <input
              id="dash-ask-ai"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={dash.aiPromptPlaceholder}
              autoComplete="off"
            />
            <button type="submit" className="dash-ask__submit">
              Ask AI
            </button>
          </form>
        </header>

        <ul className="dash-stats">
          {dash.stats.map((stat) => (
            <li key={stat.key}>
              <Link to={stat.to} className="dash-stat">
                <span className="dash-stat__label">{stat.label}</span>
                <span className="dash-stat__value">{stat.value}</span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="dash-section" aria-labelledby="dash-projects-heading">
          <h2 id="dash-projects-heading" className="dash-section__title">
            Active projects
          </h2>
          <ul className="dash-projects">
            {dash.projects.map((project) => (
              <li key={project.id} className="dash-project">
                <div className="dash-project__row">
                  <span className="dash-project__name">{project.name}</span>
                  <span className="dash-project__pct">{project.progressPercent}%</span>
                </div>
                <div
                  className="dash-project__track"
                  role="progressbar"
                  aria-valuenow={project.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${project.name} progress`}
                >
                  <div
                    className="dash-project__fill"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-section" aria-labelledby="dash-services-heading">
          <h2 id="dash-services-heading" className="dash-section__title">
            Services
          </h2>
          <ul className="dash-services">
            {dash.services.map((service) => (
              <li key={service.id} className="dash-service">
                <span className="dash-service__name">{service.name}</span>
                <span className="dash-service__detail">{service.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="dash-footer">
          <div className="dash-footer__block">
            <h2 className="dash-section__title">Invoices</h2>
            <p className="dash-invoice">
              <span className="dash-invoice__amount">{dash.invoice.amountLabel}</span>{" "}
              <span className="dash-invoice__due">{dash.invoice.dueLabel}</span>
            </p>
          </div>
          <div className="dash-footer__block dash-footer__block--ai">
            <h2 className="dash-section__title">AI Support</h2>
            <Link className="dash-ai-link" to="/ai">
              Ask AI →
            </Link>
          </div>
        </footer>
      </div>
    </section>
  );
}
