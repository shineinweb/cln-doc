/**
 * AiService — domain orchestration used by NestJS only.
 *
 * Call stack:
 *   React → NestJS API (AiController) → AiService → LLMProvider → OpenAI transport
 *
 * React must never import this package's providers or call OpenAI directly.
 */

import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
} from "./providers/embedding-provider";
import type {
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamEvent,
} from "./providers/llm-provider";

export type AiServiceOptions = {
  llm: LLMProvider;
  embeddings?: EmbeddingProvider;
};

export class AiService {
  private readonly llm: LLMProvider;
  private readonly embeddings?: EmbeddingProvider;

  constructor(options: AiServiceOptions) {
    this.llm = options.llm;
    this.embeddings = options.embeddings;
  }

  get llmProviderName(): string {
    return this.llm.name;
  }

  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    return this.llm.complete(request);
  }

  stream(request: LlmCompletionRequest): AsyncIterable<LlmStreamEvent> {
    return this.llm.stream(request);
  }

  embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!this.embeddings) {
      return Promise.reject(
        new Error("AiService.embed: EmbeddingProvider is not configured on this AiService"),
      );
    }
    return this.embeddings.embed(request);
  }
}
