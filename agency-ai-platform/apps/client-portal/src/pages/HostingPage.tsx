import { HostingAccountCard } from "../components/HostingAccountCard";
import { PLACEHOLDER_HOSTING_ACCOUNTS, PLACEHOLDER_NOTICE } from "../data/placeholders";

export function HostingPage() {
  return (
    <section className="portal-page animate-rise">
      <header className="portal-page__header">
        <h1 className="portal-page__title">Hosting</h1>
        <p className="portal-page__lede">
          Status and usage for your hosting accounts. Management actions use the hosting provider —
          WHM SSO is not wired yet.
        </p>
        <p className="placeholder-badge" role="note">
          {PLACEHOLDER_NOTICE}
        </p>
      </header>
      <div className="hosting-list">
        {PLACEHOLDER_HOSTING_ACCOUNTS.map((account) => (
          <HostingAccountCard key={account.id} account={account} />
        ))}
      </div>
    </section>
  );
}
