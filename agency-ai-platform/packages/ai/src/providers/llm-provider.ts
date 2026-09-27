/**
 * LLMProvider — OpenAI (and future adapters) implement this interface.
 * React apps must not call vendor SDKs; Nest calls AiService → LLMProvider.
 */

export type LlmRole = "system" | "user" | "assistant" | "tool";

export type LlmMessage = {
  role: LlmRole;
  content: string;
  name?: string;
};

export type LlmCompletionRequest = {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type LlmCompletionResponse = {
  content: string;
  model: string;
  provider: string;
  finishReason?: string;
};

export type LlmStreamEvent = {
  type: "delta" | "done" | "error";
  content?: string;
  error?: string;
};

export interface LLMProvider {
  readonly name: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  stream(request: LlmCompletionRequest): AsyncIterable<LlmStreamEvent>;
}
