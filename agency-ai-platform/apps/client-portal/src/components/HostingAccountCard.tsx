import { Link } from "react-router-dom";
import { formatUsagePair, usagePercent } from "@agency/hosting";
import type { PortalHostingAccountView } from "../data/placeholders";

type HostingAccountCardProps = {
  account: PortalHostingAccountView;
};

export function HostingAccountCard({ account }: HostingAccountCardProps) {
  const diskPct = usagePercent(account.diskUsedBytes, account.diskLimitBytes);
  const bandwidthPct = usagePercent(
    account.bandwidthUsedBytes,
    account.bandwidthLimitBytes,
  );

  return (
    <article className="hosting-card" aria-labelledby={`hosting-${account.id}-title`}>
      <header className="hosting-card__header">
        <p className="hosting-card__eyebrow">Hosting</p>
        <h2 id={`hosting-${account.id}-title`} className="hosting-card__domain">
          {account.domain}
        </h2>
        <p className="hosting-card__package">{account.packageName}</p>
        <p className="hosting-card__status">
          Status: <span data-status={account.statusLabel}>{account.statusLabel}</span>
        </p>
      </header>

      <dl className="hosting-meters">
        <div className="hosting-meter">
          <dt>Disk</dt>
          <dd>
            <span className="hosting-meter__value">
              {formatUsagePair(account.diskUsedBytes, account.diskLimitBytes)}
            </span>
            <div
              className="hosting-meter__track"
              role="meter"
              aria-label="Disk usage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(diskPct)}
            >
              <div className="hosting-meter__fill" style={{ width: `${diskPct}%` }} />
            </div>
          </dd>
        </div>
        <div className="hosting-meter">
          <dt>Bandwidth</dt>
          <dd>
            <span className="hosting-meter__value">
              {formatUsagePair(account.bandwidthUsedBytes, account.bandwidthLimitBytes)}
            </span>
            <div
              className="hosting-meter__track"
              role="meter"
              aria-label="Bandwidth usage"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(bandwidthPct)}
            >
              <div
                className="hosting-meter__fill hosting-meter__fill--band"
                style={{ width: `${bandwidthPct}%` }}
              />
            </div>
          </dd>
        </div>
      </dl>

      <div className="hosting-card__actions">
        <Link className="hosting-cta" to={`/hosting/${account.id}/manage`}>
          Manage Hosting
        </Link>
      </div>
    </article>
  );
}
