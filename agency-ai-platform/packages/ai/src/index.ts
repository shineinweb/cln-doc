/**
 * @agency/ai — provider interfaces, OpenAI adapters, and AiService.
 *
 * Stack: React → NestJS API → AiService → LLMProvider (OpenAI) → OpenAI
 */

export type { AiServiceOptions } from "./ai-service";
export { AiService } from "./ai-service";

export type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmMessage,
  LlmRole,
  LlmStreamEvent,
  LLMProvider,
} from "./providers/llm-provider";

export type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./providers/embedding-provider";

export type {
  VectorMatch,
  VectorQuery,
  VectorStore,
  VectorUpsert,
} from "./providers/vector-store";

export {
  OPENAI_LLM_PROVIDER_NAME,
  OpenAiLlmProvider,
  LlmProviderUnwiredError,
  UnwiredOpenAiApiTransport,
} from "./providers/openai-llm-provider";
export type {
  OpenAiApiTransport,
  OpenAiChatParams,
  OpenAiChatResult,
  OpenAiLlmConfig,
} from "./providers/openai-llm-provider";

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
