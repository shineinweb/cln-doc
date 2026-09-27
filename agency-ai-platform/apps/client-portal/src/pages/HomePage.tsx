import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <section className="portal-page animate-rise">
      <h1 className="portal-page__title">Welcome{user ? `, ${user.name}` : ""}</h1>
      <p className="portal-page__lede">
        Manage projects, billing, hosting, and support from your customer portal.
      </p>
      <div className="actions">
        <Link className="hosting-cta" to="/hosting">
          View hosting
        </Link>
        <Link className="hosting-cta hosting-cta--ghost" to="/tickets/new">
          New Ticket
        </Link>
      </div>
    </section>
  );
}
