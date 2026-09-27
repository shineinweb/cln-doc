import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@agency/ui";
import {
  SUPPORT_TICKET_DEPARTMENTS,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_PRIORITY_LABELS,
  type SupportTicketDepartmentKey,
  type SupportTicketPriorityValue,
} from "@agency/shared";
import { PLACEHOLDER_NOTICE, PLACEHOLDER_NEW_TICKET } from "../data/placeholders";

type SubmittedTicket = {
  department: SupportTicketDepartmentKey;
  priority: SupportTicketPriorityValue;
  subject: string;
  message: string;
};

export function NewTicketPage() {
  const [department, setDepartment] = useState<SupportTicketDepartmentKey>(
    PLACEHOLDER_NEW_TICKET.department,
  );
  const [priority, setPriority] = useState<SupportTicketPriorityValue>(
    PLACEHOLDER_NEW_TICKET.priority,
  );
  const [subject, setSubject] = useState<string>(PLACEHOLDER_NEW_TICKET.subject);
  const [message, setMessage] = useState<string>(PLACEHOLDER_NEW_TICKET.message);
  const [submitted, setSubmitted] = useState<SubmittedTicket | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // PLACEHOLDER: POST /api/v1/portal/tickets is not wired yet.
    setSubmitted({ department, priority, subject: subject.trim(), message: message.trim() });
  }

  return (
    <section className="portal-page animate-rise">
      <header className="portal-page__header">
        <p className="portal-page__eyebrow">Support</p>
        <h1 className="portal-page__title">New Ticket</h1>
        <p className="portal-page__lede">
          Open a support request. Submissions are placeholder until the portal tickets API is wired.
        </p>
        <p className="placeholder-badge" role="note">
          {PLACEHOLDER_NOTICE}
        </p>
      </header>

      {submitted ? (
        <div className="ticket-form ticket-form--success" role="status">
          <h2 className="ticket-form__success-title">Ticket captured (placeholder)</h2>
          <p className="portal-page__lede">
            {SUPPORT_TICKET_PRIORITY_LABELS[submitted.priority]} ·{" "}
            {SUPPORT_TICKET_DEPARTMENTS.find((item) => item.key === submitted.department)?.label ??
              submitted.department}
          </p>
          <p className="ticket-form__success-subject">{submitted.subject}</p>
          <div className="actions" style={{ marginTop: "1.25rem" }}>
            <Button
              type="button"
              onClick={() => {
                setSubmitted(null);
                setDepartment(PLACEHOLDER_NEW_TICKET.department);
                setPriority(PLACEHOLDER_NEW_TICKET.priority);
                setSubject(PLACEHOLDER_NEW_TICKET.subject);
                setMessage(PLACEHOLDER_NEW_TICKET.message);
              }}
            >
              Create another
            </Button>
            <Link className="hosting-cta hosting-cta--ghost" to="/tickets">
              Back to tickets
            </Link>
          </div>
        </div>
      ) : (
        <form className="ticket-form" onSubmit={onSubmit} noValidate>
          <label className="ticket-field">
            <span className="ticket-field__label">Department</span>
            <select
              name="department"
              value={department}
              onChange={(event) => setDepartment(event.target.value as SupportTicketDepartmentKey)}
              required
            >
              {SUPPORT_TICKET_DEPARTMENTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ticket-field">
            <span className="ticket-field__label">Priority</span>
            <select
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as SupportTicketPriorityValue)}
              required
            >
              {SUPPORT_TICKET_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {SUPPORT_TICKET_PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label className="ticket-field">
            <span className="ticket-field__label">Subject</span>
            <input
              name="subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              maxLength={300}
              placeholder="Website unavailable"
            />
          </label>

          <label className="ticket-field">
            <span className="ticket-field__label">Message</span>
            <textarea
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={6}
              placeholder="Describe what happened…"
            />
          </label>

          <div className="ticket-form__actions">
            <Button type="submit">Submit ticket</Button>
            <Link className="hosting-cta hosting-cta--ghost" to="/tickets">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
