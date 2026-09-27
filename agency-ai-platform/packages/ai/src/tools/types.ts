/**
 * Shared AI tool types.
 */

export type AiToolRisk = "read" | "write" | "destructive";

export type AiToolParameter = {
  type: string;
  description: string;
  required?: boolean;
};

export type AiToolDefinition = {
  name: string;
  description: string;
  risk: AiToolRisk;
  /** When true, Approvals module must gate execution. */
  requiresApproval: boolean;
  /** JSON-schema-ish parameter hints for the LLM (not validated yet). */
  parameters: Record<string, AiToolParameter>;
};

export type AiToolInvokeContext = {
  organizationId: string;
  userId: string;
  /** Present for portal / customer-scoped tools. */
  customerId?: string;
  /** Optional project or repo scope for Coding AI. */
  projectId?: string;
  repositoryRef?: string;
};
