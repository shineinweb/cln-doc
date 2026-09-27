/**
 * OpenAiLlmProvider — OpenAI adapter for LLMProvider.
 *
 * PLACEHOLDER: no live OpenAI SDK is shipped here. Nest (or tests) must inject
 * an OpenAiApiTransport. Do not call OpenAI from React or Nest controllers.
 */

import type {
  LLMProvider,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamEvent,
} from "./llm-provider";

export const OPENAI_LLM_PROVIDER_NAME = "openai" as const;

export type OpenAiLlmConfig = {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
};

export type OpenAiChatParams = {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
};

export type OpenAiChatResult = {
  content: string;
  model: string;
  finishReason?: string;
};

/** Vendor-shaped OpenAI call surface — keep Nest/React free of the OpenAI SDK. */
export interface OpenAiApiTransport {
  chatCompletions(params: OpenAiChatParams): Promise<OpenAiChatResult>;
  streamChatCompletions(params: OpenAiChatParams): AsyncIterable<LlmStreamEvent>;
}

export class LlmProviderUnwiredError extends Error {
  constructor(operation: string) {
    super(
      `OpenAiLlmProvider.${operation}: OpenAI API transport is not wired. ` +
        "Inject an OpenAiApiTransport (sandbox or production) — do not invent fake remote APIs in apps.",
    );
    this.name = "LlmProviderUnwiredError";
  }
}

export class UnwiredOpenAiApiTransport implements OpenAiApiTransport {
  chatCompletions(): Promise<OpenAiChatResult> {
    return Promise.reject(new LlmProviderUnwiredError("complete"));
  }

  async *streamChatCompletions(): AsyncIterable<LlmStreamEvent> {
    yield {
      type: "error",
      error: new LlmProviderUnwiredError("stream").message,
    };
  }
}

export class OpenAiLlmProvider implements LLMProvider {
  readonly name = OPENAI_LLM_PROVIDER_NAME;

  constructor(
    private readonly config: OpenAiLlmConfig,
    private readonly transport: OpenAiApiTransport = new UnwiredOpenAiApiTransport(),
  ) {
    if (!config.apiKey.trim()) {
      throw new Error("OpenAiLlmProvider: apiKey is required");
    }
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const result = await this.transport.chatCompletions({
      model: request.model || this.config.defaultModel || "gpt-4o-mini",
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });

    return {
      content: result.content,
      model: result.model,
      provider: this.name,
      finishReason: result.finishReason,
    };
  }

  async *stream(request: LlmCompletionRequest): AsyncIterable<LlmStreamEvent> {
    yield* this.transport.streamChatCompletions({
      model: request.model || this.config.defaultModel || "gpt-4o-mini",
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }
}
