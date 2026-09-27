/**
 * Customer Support AI tool surface (portal-scoped).
 */

import type { AiToolDefinition } from "./types";

export const CUSTOMER_SUPPORT_TOOL_NAMES = [
  "getCurrentCustomer",
  "getCustomerServices",
  "getCustomerDomains",
  "getCustomerHosting",
  "getCustomerInvoices",
  "getCustomerTickets",
  "searchKnowledge",
  "createTicket",
  "replyTicket",
] as const;

export type CustomerSupportToolName = (typeof CUSTOMER_SUPPORT_TOOL_NAMES)[number];

export const CUSTOMER_SUPPORT_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "getCurrentCustomer",
    description: "Return the authenticated customer profile for the current session.",
    risk: "read",
    requiresApproval: false,
    parameters: {},
  },
  {
    name: "getCustomerServices",
    description: "List active and pending services for the current customer.",
    risk: "read",
    requiresApproval: false,
    parameters: {},
  },
  {
    name: "getCustomerDomains",
    description: "List domains owned by the current customer.",
    risk: "read",
    requiresApproval: false,
    parameters: {},
  },
  {
    name: "getCustomerHosting",
    description: "List hosting accounts and high-level status for the current customer.",
    risk: "read",
    requiresApproval: false,
    parameters: {},
  },
  {
    name: "getCustomerInvoices",
    description: "List invoices for the current customer (amounts, status, due dates).",
    risk: "read",
    requiresApproval: false,
    parameters: {
      status: {
        type: "string",
        description: "Optional invoice status filter.",
        required: false,
      },
    },
  },
  {
    name: "getCustomerTickets",
    description: "List support tickets for the current customer.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      status: {
        type: "string",
        description: "Optional ticket status filter.",
        required: false,
      },
    },
  },
  {
    name: "searchKnowledge",
    description: "Search published knowledge base chunks (RAG) for an answer.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      query: {
        type: "string",
        description: "Natural-language search query.",
        required: true,
      },
      limit: {
        type: "number",
        description: "Max hits to return.",
        required: false,
      },
    },
  },
  {
    name: "createTicket",
    description: "Create a support ticket for the current customer (department, subject, body).",
    risk: "write",
    requiresApproval: false,
    parameters: {
      department: {
        type: "string",
        description: "Support department key (e.g. hosting, billing).",
        required: true,
      },
      subject: {
        type: "string",
        description: "Ticket subject line.",
        required: true,
      },
      body: {
        type: "string",
        description: "Initial ticket message body.",
        required: true,
      },
      priority: {
        type: "string",
        description: "Optional priority (low, normal, high, urgent).",
        required: false,
      },
    },
  },
  {
    name: "replyTicket",
    description: "Post a customer reply on one of their existing support tickets.",
    risk: "write",
    requiresApproval: false,
    parameters: {
      ticketId: {
        type: "string",
        description: "Ticket id the customer is replying to.",
        required: true,
      },
      body: {
        type: "string",
        description: "Reply message body.",
        required: true,
      },
    },
  },
] as const;
