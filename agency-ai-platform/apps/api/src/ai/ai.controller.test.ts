import { describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { AiService, LlmProviderUnwiredError, type LLMProvider } from "@agency/ai";
import { AiController } from "./ai.controller";

describe("AiController", () => {
  it("returns completion data from AiService", async () => {
    const llm: LLMProvider = {
      name: "noop",
      complete: vi.fn(async () => ({
        content: "hello",
        model: "noop-1",
        provider: "noop",
      })),
      stream: async function* () {
        yield { type: "done" as const };
      },
    };
    const controller = new AiController(new AiService({ llm }));
    const result = await controller.complete(
      {
        messages: [{ role: "user", content: "hi" }],
      },
      {
        id: "user_1",
        email: "a@example.com",
        name: "A",
        isStaff: false,
        emailVerified: true,
        memberships: [],
        permissions: [],
        roles: ["customer"],
      },
    );
    expect(result.data.content).toBe("hello");
    expect(result.data.requestedBy).toBe("user_1");
  });

  it("maps unwired OpenAI transport to 503", async () => {
    const llm: LLMProvider = {
      name: "openai",
      complete: async () => {
        throw new LlmProviderUnwiredError("complete");
      },
      stream: async function* () {
        yield { type: "error" as const, error: "unwired" };
      },
    };
    const controller = new AiController(new AiService({ llm }));
    await expect(
      controller.complete(
        { messages: [{ role: "user", content: "hi" }] },
        {
          id: "user_1",
          email: "a@example.com",
          name: "A",
          isStaff: false,
          emailVerified: true,
          memberships: [],
          permissions: [],
          roles: ["customer"],
        },
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
