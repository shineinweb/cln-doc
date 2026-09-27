/**
 * @agency/ai
 *
 * packages/ai/
 *   providers/    LLM, Embedding, VectorStore + OpenAI adapters
 *   agents/       Supervisor + specialist roster
 *   tools/        Tool registry (provider-backed handlers later)
 *   knowledge/    RAG chunking + retrieval orchestration
 *   memory/       Memory write/read policies
 *   evaluations/  Eval harness stubs
 *   approvals/    Human-in-the-loop gates
 *   security/     Kill switch, quotas, risk defaults
 *
 * Stack: React → NestJS API → AiService → LLMProvider → OpenAI
 */

export type { AiServiceOptions } from "./ai-service";
export { AiService } from "./ai-service";

export * from "./providers";
export * from "./agents";
export * from "./tools";
export * from "./knowledge";
export * from "./memory";
export * from "./evaluations";
export * from "./approvals";
export * from "./security";

/** @deprecated Prefer LlmMessage via LLMProvider / AiService. */
export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** @deprecated Prefer LlmCompletionRequest. */
export type AiCompletionRequest = {
  model: string;
  messages: AiMessage[];
};

/** @deprecated Prefer LlmCompletionResponse. */
export type AiCompletionResponse = {
  content: string;
  model: string;
};

/** @deprecated Prefer AiService.complete with an injected LLMProvider. */
export async function completeStub(request: AiCompletionRequest): Promise<AiCompletionResponse> {
  return {
    model: request.model,
    content: "AI provider not configured yet.",
  };
}
