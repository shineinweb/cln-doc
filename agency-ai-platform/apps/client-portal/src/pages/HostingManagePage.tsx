import { Link, Navigate, useParams } from "react-router-dom";
import { PLACEHOLDER_HOSTING_ACCOUNTS, PLACEHOLDER_NOTICE } from "../data/placeholders";

export function HostingManagePage() {
  const { accountId } = useParams();
  const account = PLACEHOLDER_HOSTING_ACCOUNTS.find((item) => item.id === accountId);

  if (!account) {
    return <Navigate to="/hosting" replace />;
  }

  return (
    <section className="portal-page animate-rise">
      <p className="portal-page__eyebrow">Manage Hosting</p>
      <h1 className="portal-page__title">{account.domain}</h1>
      <p className="portal-page__lede">
        {account.packageName} — cPanel/WHM management (SSO, file manager, email) is a PLACEHOLDER.
        No fake remote control panel is exposed here.
      </p>
      <p className="placeholder-badge" role="note">
        {PLACEHOLDER_NOTICE}
      </p>
      <div className="actions" style={{ marginTop: "1.25rem" }}>
        <Link className="hosting-cta hosting-cta--ghost" to="/hosting">
          Back to hosting
        </Link>
      </div>
    </section>
  );
}
