import { Link } from "react-router-dom";
import {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_PRIORITY_LABELS,
} from "@agency/shared";
import { PLACEHOLDER_NOTICE, PLACEHOLDER_PORTAL_TICKETS } from "../data/placeholders";

export function TicketsPage() {
  return (
    <section className="portal-page animate-rise">
      <header className="portal-page__header">
        <div className="portal-page__header-row">
          <div>
            <h1 className="portal-page__title">Tickets</h1>
            <p className="portal-page__lede">
              Your support conversations. Open a new ticket when something needs attention.
            </p>
          </div>
          <Link className="hosting-cta" to="/tickets/new">
            New Ticket
          </Link>
        </div>
        <p className="placeholder-badge" role="note">
          {PLACEHOLDER_NOTICE}
        </p>
      </header>

      <div className="ticket-list">
        {PLACEHOLDER_PORTAL_TICKETS.map((ticket) => {
          const department =
            SUPPORT_TICKET_DEPARTMENTS.find((item) => item.key === ticket.department)?.label ??
            ticket.department;
          return (
            <article key={ticket.id} className="ticket-row">
              <div>
                <p className="ticket-row__meta">
                  #{ticket.number} · {department} ·{" "}
                  {SUPPORT_TICKET_PRIORITY_LABELS[ticket.priority]}
                </p>
                <h2 className="ticket-row__subject">{ticket.subject}</h2>
              </div>
              <p className="ticket-row__status" data-status={ticket.status}>
                {ticket.statusLabel}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
