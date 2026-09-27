/**
 * Tool registry — customer-scoped support tools + invoke stubs.
 * Handlers call domain services / providers later; PLACEHOLDER for now.
 */

export type AiToolRisk = "read" | "write" | "destructive";

export type AiToolDefinition = {
  name: string;
  description: string;
  risk: AiToolRisk;
  /** When true, Approvals module must gate execution. */
  requiresApproval: boolean;
  /** JSON-schema-ish parameter hints for the LLM (not validated yet). */
  parameters: Record<
    string,
    { type: string; description: string; required?: boolean }
  >;
};

/** Customer Support AI tool surface (portal-scoped). */
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

export type CustomerSupportToolName =
  (typeof CUSTOMER_SUPPORT_TOOL_NAMES)[number];

export const AI_TOOL_REGISTRY: readonly AiToolDefinition[] = [
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
    description:
      "Create a support ticket for the current customer (department, subject, body).",
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

export class AiToolUnwiredError extends Error {
  readonly toolName: string;

  constructor(toolName: string) {
    super(
      `AI tool "${toolName}" is PLACEHOLDER — bind a domain handler before invoking.`,
    );
    this.name = "AiToolUnwiredError";
    this.toolName = toolName;
  }
}

export type AiToolInvokeContext = {
  organizationId: string;
  userId: string;
  customerId: string;
};

export function listTools(): readonly AiToolDefinition[] {
  return AI_TOOL_REGISTRY;
}

export function getTool(name: string): AiToolDefinition | undefined {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function isCustomerSupportTool(name: string): name is CustomerSupportToolName {
  return (CUSTOMER_SUPPORT_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * PLACEHOLDER invoke — fails loudly until Nest binds domain handlers.
 * `searchKnowledge` is the only soft stub (returns [] via knowledge module later).
 */
export async function invokeTool(
  name: string,
  _args: Record<string, unknown>,
  _ctx: AiToolInvokeContext,
): Promise<unknown> {
  const tool = getTool(name);
  if (!tool) {
    throw new Error(`Unknown AI tool: ${name}`);
  }
  throw new AiToolUnwiredError(name);
}
