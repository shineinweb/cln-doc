/** AI approval gates + execution pipeline (human-in-the-loop). */
export { createPendingApproval, requiresApproval } from "./gates";
export type { ApprovalDecision, ApprovalRequest } from "./gates";

export {
  APPROVAL_PIPELINE,
  APPROVAL_PIPELINE_DIAGRAM,
  APPROVAL_PIPELINE_STAGES,
  completeApprovedToolAudit,
  decideToolApproval,
  getApprovalPipelineStage,
  getNextApprovalPipelineStage,
  isApprovalPipelineStage,
  requestToolApproval,
} from "./pipeline";
export type {
  ApprovalAuditEntry,
  ApprovalPipelineActor,
  ApprovalPipelineResult,
  ApprovalPipelineStage,
  ApprovalPipelineStageDefinition,
} from "./pipeline";
