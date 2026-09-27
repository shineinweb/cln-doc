/** AI package — model providers and agent tooling. */
export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiCompletionRequest = {
  model: string;
  messages: AiMessage[];
};

export type AiCompletionResponse = {
  content: string;
  model: string;
};

export async function completeStub(
  request: AiCompletionRequest,
): Promise<AiCompletionResponse> {
  return {
    model: request.model,
    content: "AI provider not configured yet.",
  };
}
