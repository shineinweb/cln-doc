/**
 * Tool registry — merges agent tool surfaces + invoke stubs.
 * Handlers call domain services / providers later; PLACEHOLDER for now.
 */

import {
  CODING_TOOL_NAMES,
  CODING_TOOLS,
  type CodingToolName,
} from "./coding-tools";
import {
  CUSTOMER_SUPPORT_TOOL_NAMES,
  CUSTOMER_SUPPORT_TOOLS,
  type CustomerSupportToolName,
} from "./customer-support-tools";
import type { AiToolDefinition, AiToolInvokeContext } from "./types";

export type { AiToolDefinition, AiToolInvokeContext, AiToolRisk } from "./types";
export {
  CODING_TOOL_NAMES,
  CODING_TOOLS,
  type CodingToolName,
} from "./coding-tools";
export {
  CUSTOMER_SUPPORT_TOOL_NAMES,
  CUSTOMER_SUPPORT_TOOLS,
  type CustomerSupportToolName,
} from "./customer-support-tools";

export const AI_TOOL_REGISTRY: readonly AiToolDefinition[] = [
  ...CUSTOMER_SUPPORT_TOOLS,
  ...CODING_TOOLS,
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

export function listTools(): readonly AiToolDefinition[] {
  return AI_TOOL_REGISTRY;
}

export function getTool(name: string): AiToolDefinition | undefined {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

export function isCustomerSupportTool(
  name: string,
): name is CustomerSupportToolName {
  return (CUSTOMER_SUPPORT_TOOL_NAMES as readonly string[]).includes(name);
}

export function isCodingTool(name: string): name is CodingToolName {
  return (CODING_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * PLACEHOLDER invoke — fails loudly until Nest binds domain handlers.
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
