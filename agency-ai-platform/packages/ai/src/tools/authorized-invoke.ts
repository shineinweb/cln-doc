/**
 * Authorized AI tool invocation — authz + approval gates before handlers.
 */

import type { ApprovalRequest } from "../approvals/gates";
import { requiresApproval } from "../approvals/gates";
import {
  AiAuthorizationError,
  assertAiActorAuthorized,
  type AiActor,
} from "../security/authorization";
import { getTool, invokeTool } from "./registry";
import type { AiToolInvokeContext } from "./types";

export class AiApprovalRequiredError extends Error {
  readonly toolName: string;

  constructor(toolName: string, reason: string) {
    super(reason);
    this.name = "AiApprovalRequiredError";
    this.toolName = toolName;
  }
}

export type AuthorizedInvokeOptions = {
  actor: AiActor;
  /** Required when the tool is approval-gated; must be status=approved for that tool. */
  approval?: ApprovalRequest | null;
};

/**
 * Assert approval is present and approved for the named tool.
 * AI cannot execute approval-required tools without human approval.
 */
export function assertToolApprovalGranted(
  toolName: string,
  toolRisk: "read" | "write" | "destructive",
  toolRequiresApproval: boolean,
  approval: ApprovalRequest | null | undefined,
): void {
  if (!requiresApproval(toolRisk, toolRequiresApproval)) {
    return;
  }
  if (!approval) {
    throw new AiApprovalRequiredError(
      toolName,
      `AI tool "${toolName}" requires human approval before execution`,
    );
  }
  if (approval.toolName !== toolName) {
    throw new AiApprovalRequiredError(
      toolName,
      `Approval ${approval.id} is for tool "${approval.toolName}", not "${toolName}"`,
    );
  }
  if (approval.status !== "approved") {
    throw new AiApprovalRequiredError(
      toolName,
      `AI tool "${toolName}" cannot execute: approval status=${approval.status}`,
    );
  }
}

/**
 * Full gate: actor authz → approval (if required) → invokeTool.
 * Does not grant the model elevated permissions.
 */
export async function invokeAuthorizedTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiToolInvokeContext,
  options: AuthorizedInvokeOptions,
): Promise<unknown> {
  assertAiActorAuthorized(options.actor, ctx);

  const tool = getTool(name);
  if (!tool) {
    throw new AiAuthorizationError(`Unknown AI tool: ${name}`, "UNKNOWN_TOOL");
  }

  assertToolApprovalGranted(name, tool.risk, tool.requiresApproval, options.approval);

  return invokeTool(name, args, ctx);
}
