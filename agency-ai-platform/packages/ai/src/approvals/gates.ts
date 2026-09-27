/**
 * Human-in-the-loop approval gates.
 * PLACEHOLDER: AiApproval persistence + admin queue UX land in Phase 8+.
 */

import type { AiToolRisk } from "../tools/registry";

export type ApprovalDecision = "pending" | "approved" | "denied" | "expired";

export type ApprovalRequest = {
  id: string;
  toolName: string;
  risk: AiToolRisk;
  requestedByUserId?: string;
  rationale: string;
  status: ApprovalDecision;
};

export function requiresApproval(risk: AiToolRisk, toolRequiresApproval: boolean): boolean {
  if (toolRequiresApproval) return true;
  return risk === "destructive" || risk === "write";
}

/** PLACEHOLDER — always returns pending; Nest must persist AiApproval records. */
export function createPendingApproval(input: {
  toolName: string;
  risk: AiToolRisk;
  rationale: string;
  requestedByUserId?: string;
}): ApprovalRequest {
  return {
    id: `apr_placeholder_${input.toolName}`,
    toolName: input.toolName,
    risk: input.risk,
    requestedByUserId: input.requestedByUserId,
    rationale: input.rationale,
    status: "pending",
  };
}
