import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  QUOTE_CUSTOMER_ACTIONS,
  WEBSITE_DEVELOPMENT_PACKAGE,
  canPerformQuoteAction,
  formatUsdFromCents,
  nextQuoteStatusAfterAction,
  type QuoteCustomerAction,
  type QuoteStatusValue,
} from "@agency/shared";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { StatusPill } from "@/components/ui/StatusPill";
import { PLACEHOLDER_QUOTES, formatMoney } from "@/data/placeholders";

type LocalQuote = {
  id: string;
  number: string;
  title: string;
  status: QuoteStatusValue;
  totalCents: number;
  monthlyCents: number | null;
  currency: string;
  organization: string;
  validUntil: string;
  lines: readonly string[];
  customerMessage: string | null;
};

export function QuoteDetailPage() {
  const { quoteId } = useParams();
  const seed = PLACEHOLDER_QUOTES.find((item) => item.id === quoteId);

  const [quote, setQuote] = useState<LocalQuote | null>(() =>
    seed
      ? {
          id: seed.id,
          number: seed.number,
          title: seed.title,
          status: seed.status as QuoteStatusValue,
          totalCents: seed.totalCents,
          monthlyCents: seed.monthlyCents,
          currency: seed.currency,
          organization: seed.organization,
          validUntil: seed.validUntil,
          lines: "lines" in seed ? seed.lines : [],
          customerMessage: null,
        }
      : null,
  );
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const packageLines = useMemo(() => {
    if (quote?.title !== WEBSITE_DEVELOPMENT_PACKAGE.name) return null;
    return WEBSITE_DEVELOPMENT_PACKAGE;
  }, [quote?.title]);

  if (!quote) {
    return <Navigate to="/admin/quotes" replace />;
  }

  function applyAction(action: QuoteCustomerAction) {
    if (!quote) return;
    if (!canPerformQuoteAction(quote.status, action)) {
      setNotice(`“${action}” is not available while status is ${quote.status}.`);
      return;
    }

    if (action === "view") {
      setNotice("Development placeholder: quote marked viewed (no API call).");
      return;
    }

    const nextStatus = nextQuoteStatusAfterAction(action);
    setQuote({
      ...quote,
      status: nextStatus,
      customerMessage:
        action === "request_changes"
          ? message.trim() || "Changes requested (placeholder)."
          : quote.customerMessage,
    });
    setNotice(
      `Development placeholder: applied “${action}” → ${nextStatus}. Wire to POST /api/v1/portal/quotes/:id/${action === "request_changes" ? "request-changes" : action}.`,
    );
    if (action === "request_changes") setMessage("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/quotes" className="text-sm font-semibold text-[var(--color-accent)]">
          ← Quotes
        </Link>
      </div>
      <PageHeader
        title={quote.title}
        description={`${quote.number} · ${quote.organization} · Valid until ${quote.validUntil}`}
        actions={<StatusPill label={quote.status} />}
      />
      <PlaceholderBadge />

      <section className="surface animate-rise rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Line items</h2>
        {packageLines ? (
          <ul className="mt-4 divide-y divide-[var(--border)] text-sm">
            {packageLines.oneTimeLines.map((line) => (
              <li key={line.key} className="flex justify-between gap-4 py-2">
                <span>{line.label}</span>
                <span className="font-semibold tabular-nums">
                  {formatUsdFromCents(line.amountCents)}
                </span>
              </li>
            ))}
            {packageLines.monthlyLines.map((line) => (
              <li key={line.key} className="flex justify-between gap-4 py-2">
                <span>{line.label}</span>
                <span className="font-semibold tabular-nums">
                  {formatUsdFromCents(line.amountCents, { monthly: true })}
                </span>
              </li>
            ))}
          </ul>
        ) : quote.lines.length > 0 ? (
          <ul className="mt-4 grid gap-2 text-sm">
            {quote.lines.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted mt-3 text-sm">No line items in this placeholder quote.</p>
        )}
        <div className="mt-6 grid gap-2 border-t border-[var(--border)] pt-4 sm:grid-cols-2">
          <p className="text-sm">
            <span className="text-muted">Project total</span>
            <br />
            <span className="font-display text-2xl font-bold">
              {formatMoney(quote.totalCents, quote.currency)}
            </span>
          </p>
          <p className="text-sm">
            <span className="text-muted">Monthly</span>
            <br />
            <span className="font-display text-2xl font-bold">
              {quote.monthlyCents != null
                ? `${formatMoney(quote.monthlyCents, quote.currency)}/mo`
                : "—"}
            </span>
          </p>
        </div>
      </section>

      <section className="surface animate-rise rounded-2xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold">Customer actions</h2>
        <p className="text-muted mt-2 text-sm">
          Portal actions for this quote — local UI only until quote APIs ship.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUOTE_CUSTOMER_ACTIONS.map((item) => {
            const enabled = canPerformQuoteAction(quote.status, item.action);
            return (
              <button
                key={item.action}
                type="button"
                disabled={!enabled}
                onClick={() => applyAction(item.action)}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.action === "accept"
                    ? "bg-[var(--color-accent)] text-white"
                    : item.action === "reject"
                      ? "border border-[var(--color-danger)] text-[var(--color-danger)]"
                      : "border border-[var(--border)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <label className="mt-4 grid gap-2 text-sm font-semibold">
          Message for Request changes
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Optional customer notes…"
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
          />
        </label>
        {quote.customerMessage ? (
          <p className="text-muted mt-3 text-sm" role="status">
            Last customer message: {quote.customerMessage}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 text-sm text-[var(--color-accent)]" role="status">
            {notice}
          </p>
        ) : null}
      </section>
    </div>
  );
}
