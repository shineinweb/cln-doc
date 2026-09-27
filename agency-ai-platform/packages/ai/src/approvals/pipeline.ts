/**
 * Human approval execution pipeline for gated AI tools.
 *
 *   AI requests approval
 *          ↓
 *   Admin approves
 *          ↓
 *   Tool executes
 *          ↓
 *   Audit log
 */

import type { AiToolRisk } from "../tools/types";
import type { ApprovalDecision, ApprovalRequest } from "./gates";
import { createPendingApproval } from "./gates";

export const APPROVAL_PIPELINE_STAGES = [
  "ai_requests_approval",
  "admin_approves",
  "tool_executes",
  "audit_log",
] as const;

export type ApprovalPipelineStage = (typeof APPROVAL_PIPELINE_STAGES)[number];

export type ApprovalPipelineActor = "coding_ai" | "support_ai" | "hosting_ai" | "admin" | "system";

export type ApprovalPipelineStageDefinition = {
  stage: ApprovalPipelineStage;
  label: string;
  description: string;
  actors: readonly ApprovalPipelineActor[];
};

export const APPROVAL_PIPELINE_DIAGRAM = `
AI requests approval
       ↓
Admin approves
       ↓
Tool executes
       ↓
Audit log
`.trim();

export const APPROVAL_PIPELINE: readonly ApprovalPipelineStageDefinition[] = [
  {
    stage: "ai_requests_approval",
    label: "AI requests approval",
    description: "Agent pauses; AiApproval created with status=pending.",
    actors: ["coding_ai", "support_ai", "hosting_ai", "system"],
  },
  {
    stage: "admin_approves",
    label: "Admin approves",
    description: "Staff with ai.approvals.decide approve or deny (+ note).",
    actors: ["admin"],
  },
  {
    stage: "tool_executes",
    label: "Tool executes",
    description: "On approve, the gated tool runs exactly once.",
    actors: ["system"],
  },
  {
    stage: "audit_log",
    label: "Audit log",
    description: "Write AuditLog (+ AiToolCall) for the decision and execution.",
    actors: ["system"],
  },
] as const;

export type ApprovalAuditEntry = {
  approvalId: string;
  toolName: string;
  decision: ApprovalDecision;
  decidedByUserId?: string;
  executed: boolean;
  /** PLACEHOLDER id until Nest persists AuditLog. */
  auditLogId: string;
};

export type ApprovalPipelineResult = {
  approval: ApprovalRequest;
  stage: ApprovalPipelineStage;
  audit?: ApprovalAuditEntry;
};

export function isApprovalPipelineStage(value: string): value is ApprovalPipelineStage {
  return (APPROVAL_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function getApprovalPipelineStage(
  stage: ApprovalPipelineStage,
): ApprovalPipelineStageDefinition {
  const found = APPROVAL_PIPELINE.find((item) => item.stage === stage);
  if (!found) {
    throw new Error(`Unknown approval pipeline stage: ${stage}`);
  }
  return found;
}

export function getNextApprovalPipelineStage(
  stage: ApprovalPipelineStage,
): ApprovalPipelineStage | null {
  const index = APPROVAL_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= APPROVAL_PIPELINE_STAGES.length - 1) return null;
  return APPROVAL_PIPELINE_STAGES[index + 1] ?? null;
}

/** Stage 1 — AI requests approval (pending AiApproval). */
export function requestToolApproval(input: {
  toolName: string;
  risk: AiToolRisk;
  rationale: string;
  requestedByUserId?: string;
}): ApprovalPipelineResult {
  return {
    approval: createPendingApproval(input),
    stage: "ai_requests_approval",
  };
}

/**
 * Stage 2 — Admin approves or denies.
 * PLACEHOLDER: Nest must persist AiApproval + notify WS.
 */
export function decideToolApproval(
  approval: ApprovalRequest,
  decision: "approved" | "denied",
  decidedByUserId: string,
): ApprovalRequest {
  if (approval.status !== "pending") {
    throw new Error(`Approval ${approval.id} is not pending (status=${approval.status})`);
  }
  return {
    ...approval,
    status: decision,
    requestedByUserId: approval.requestedByUserId ?? decidedByUserId,
  };
}

/**
 * Stages 3–4 — On approve: mark tool executable + emit audit stub.
 * Does not invoke the tool itself (Nest binds invokeTool after this gate).
 */
export function completeApprovedToolAudit(input: {
  approval: ApprovalRequest;
  decidedByUserId: string;
  executed: boolean;
}): ApprovalPipelineResult {
  if (input.approval.status !== "approved") {
    throw new Error(
      `Cannot audit-execute approval ${input.approval.id}: status=${input.approval.status}`,
    );
  }
  const audit: ApprovalAuditEntry = {
    approvalId: input.approval.id,
    toolName: input.approval.toolName,
    decision: "approved",
    decidedByUserId: input.decidedByUserId,
    executed: input.executed,
    auditLogId: `audit_placeholder_${input.approval.id}`,
  };
  return {
    approval: input.approval,
    stage: input.executed ? "audit_log" : "tool_executes",
    audit,
  };
}
