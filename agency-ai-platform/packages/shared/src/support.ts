/**
 * Canonical support ticket domain for the Agency AI Platform.
 *
 * SupportTicket → TicketMessage → TicketAttachment
 * (+ TicketAssignment, TicketStatusHistory)
 *
 * Status: Open → In progress → Waiting on customer → Waiting on us → Resolved → Closed
 */

export const SUPPORT_TICKET_DOMAIN_MODELS = [
  "SupportTicket",
  "TicketMessage",
  "TicketAttachment",
  "TicketAssignment",
  "TicketStatusHistory",
] as const;

export type SupportTicketDomainModel = (typeof SUPPORT_TICKET_DOMAIN_MODELS)[number];

export const SUPPORT_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_US",
  "RESOLVED",
  "CLOSED",
] as const;

export type SupportTicketStatusValue = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_STATUS_PIPELINE = [
  { status: "OPEN", label: "Open", description: "New ticket awaiting triage." },
  {
    status: "IN_PROGRESS",
    label: "In progress",
    description: "Staff is actively working the ticket.",
  },
  {
    status: "WAITING_ON_CUSTOMER",
    label: "Waiting on customer",
    description: "Blocked on customer reply or action.",
  },
  {
    status: "WAITING_ON_US",
    label: "Waiting on us",
    description: "Customer replied; staff action needed.",
  },
  { status: "RESOLVED", label: "Resolved", description: "Issue addressed; pending close." },
  { status: "CLOSED", label: "Closed", description: "Ticket closed; reopen starts a new cycle." },
] as const;

export const SUPPORT_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type SupportTicketPriorityValue = (typeof SUPPORT_TICKET_PRIORITIES)[number];

export function isSupportTicketStatus(value: string): value is SupportTicketStatusValue {
  return (SUPPORT_TICKET_STATUSES as readonly string[]).includes(value);
}

export function isSupportTicketPriority(value: string): value is SupportTicketPriorityValue {
  return (SUPPORT_TICKET_PRIORITIES as readonly string[]).includes(value);
}
