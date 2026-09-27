/**
 * Evaluation harness — offline/online scoring stubs.
 * PLACEHOLDER: no live eval runners yet.
 */

export type EvaluationMetric =
  | "groundedness"
  | "helpfulness"
  | "safety"
  | "latency_ms"
  | "cost_tokens";

export type EvaluationCase = {
  id: string;
  agentCode: string;
  prompt: string;
  expectedContains?: string[];
};

export type EvaluationResult = {
  caseId: string;
  metrics: Partial<Record<EvaluationMetric, number>>;
  passed: boolean;
  notes?: string;
};

/** PLACEHOLDER scorer — always fails closed until a real harness is bound. */
export function scorePlaceholder(caseId: string): EvaluationResult {
  return {
    caseId,
    metrics: {},
    passed: false,
    notes: "Evaluation harness PLACEHOLDER — no live scorer wired.",
  };
}
