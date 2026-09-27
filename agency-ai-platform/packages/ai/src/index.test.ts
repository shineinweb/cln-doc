import { describe, expect, it, vi } from "vitest";
import {
  AiService,
  OPENAI_LLM_PROVIDER_NAME,
  OpenAiLlmProvider,
  LlmProviderUnwiredError,
  UnwiredOpenAiApiTransport,
  type LLMProvider,
  type OpenAiApiTransport,
} from "./index";

describe("LLMProvider contract", () => {
  it("exposes LLMProvider as a structural contract", async () => {
    const provider: LLMProvider = {
      name: "noop",
      complete: async (request) => ({
        content: `echo:${request.messages.at(-1)?.content ?? ""}`,
        model: request.model,
        provider: "noop",
      }),
      stream: async function* () {
        yield { type: "done" as const };
      },
    };
    const result = await provider.complete({
      model: "noop-1",
      messages: [{ role: "user", content: "hello" }],
    });
    expect(result.content).toBe("echo:hello");
  });
});

describe("OpenAiLlmProvider + AiService stack", () => {
  it("rejects missing apiKey", () => {
    expect(() => new OpenAiLlmProvider({ apiKey: "" })).toThrow(/apiKey/);
  });

  it("fails loudly when OpenAI transport is unwired", async () => {
    const provider = new OpenAiLlmProvider(
      { apiKey: "sk-test" },
      new UnwiredOpenAiApiTransport(),
    );
    expect(provider.name).toBe(OPENAI_LLM_PROVIDER_NAME);
    await expect(
      provider.complete({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
      }),
    ).rejects.toBeInstanceOf(LlmProviderUnwiredError);
  });

  it("AiService delegates complete through injected LLMProvider", async () => {
    const transport: OpenAiApiTransport = {
      chatCompletions: vi.fn(async (params) => ({
        content: `ok:${params.messages[0]?.content}`,
        model: params.model,
        finishReason: "stop",
      })),
      streamChatCompletions: async function* () {
        yield { type: "done" as const };
      },
    };
    const llm = new OpenAiLlmProvider({ apiKey: "sk-test", defaultModel: "gpt-4o-mini" }, transport);
    const ai = new AiService({ llm });

    const result = await ai.complete({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "status?" }],
    });

    expect(ai.llmProviderName).toBe("openai");
    expect(result.provider).toBe("openai");
    expect(result.content).toBe("ok:status?");
    expect(transport.chatCompletions).toHaveBeenCalledOnce();
  });
});
