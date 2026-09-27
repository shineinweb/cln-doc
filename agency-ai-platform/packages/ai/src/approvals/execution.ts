/**
 * AI Execution card — diagnosis + requested action awaiting admin decision.
 *
 * Example:
 *   AI EXECUTION #18552
 *   Agent: Hosting Agent
 *   Customer: ABC Company
 *   Question: "My SSL stopped working."
 *   Tools: getHostingAccount · getDNS · getSSLStatus
 *   Diagnosis: Certificate expired
 *   Requested action: Renew certificate
 *   Risk: Medium
 *   [Approve] [Reject]
 */

import type { ApprovalDecision } from "./gates";

export const AI_EXECUTION_RISK_LEVELS = ["low", "medium", "high"] as const;

export type AiExecutionRiskLevel = (typeof AI_EXECUTION_RISK_LEVELS)[number];

export type AiExecutionToolResult = {
  name: string;
  ok: boolean;
};

export type AiExecution = {
  /** Numeric display id (e.g. 18552). */
  number: number;
  agentLabel: string;
  customerName: string;
  question: string;
  tools: readonly AiExecutionToolResult[];
  diagnosis: string;
  requestedAction: string;
  /** Tool that will run if approved. */
  requestedToolName: string;
  riskLevel: AiExecutionRiskLevel;
  status: ApprovalDecision;
};

export function formatAiExecutionTitle(execution: AiExecution): string {
  return `AI EXECUTION #${execution.number}`;
}

export function isAiExecutionRiskLevel(value: string): value is AiExecutionRiskLevel {
  return (AI_EXECUTION_RISK_LEVELS as readonly string[]).includes(value);
}
