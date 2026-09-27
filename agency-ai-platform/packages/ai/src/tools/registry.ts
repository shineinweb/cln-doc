/**
 * Tool registry — handlers call into other packages via provider interfaces.
 * PLACEHOLDER: no tool handlers execute side effects yet.
 */

export type AiToolRisk = "read" | "write" | "destructive";

export type AiToolDefinition = {
  name: string;
  description: string;
  risk: AiToolRisk;
  /** When true, Approvals module must gate execution. */
  requiresApproval: boolean;
};

export const AI_TOOL_REGISTRY: readonly AiToolDefinition[] = [
  {
    name: "knowledge.search",
    description: "Search published knowledge chunks (RAG).",
    risk: "read",
    requiresApproval: false,
  },
  {
    name: "tickets.get",
    description: "Read a support ticket summary for the current org.",
    risk: "read",
    requiresApproval: false,
  },
  {
    name: "hosting.getUsage",
    description: "Read hosting usage via HostingProvider.",
    risk: "read",
    requiresApproval: false,
  },
] as const;

export function listTools(): readonly AiToolDefinition[] {
  return AI_TOOL_REGISTRY;
}

export function getTool(name: string): AiToolDefinition | undefined {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}
