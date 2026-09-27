import { describe, expect, it, vi } from "vitest";
import {
  AI_AGENT_CODES,
  AI_AGENT_ROSTER,
  AI_ORG_CHART,
  AI_TOOL_REGISTRY,
  AiService,
  AiToolUnwiredError,
  CODING_PIPELINE_DIAGRAM,
  CODING_PIPELINE_STAGES,
  CODING_TOOL_NAMES,
  CUSTOMER_SUPPORT_TOOL_NAMES,
  canCodingAiActAtStage,
  getNextCodingPipelineStage,
  DEFAULT_AI_SECURITY_POLICY,
  DEFAULT_MEMORY_POLICIES,
  OPENAI_LLM_PROVIDER_NAME,
  OpenAiLlmProvider,
  LlmProviderUnwiredError,
  UnwiredOpenAiApiTransport,
  assertAiEnabled,
  chunkText,
  clampMaxTokens,
  getAgentDefinition,
  getTool,
  invokeTool,
  listAgentsByTier,
  listSpecialists,
  requiresApproval,
  scorePlaceholder,
  searchKnowledge,
  type LLMProvider,
  type OpenAiApiTransport,
} from "./index";

describe("package module map", () => {
  it("exposes agents, tools, knowledge, memory, evaluations, approvals, security", () => {
    expect(AI_AGENT_ROSTER.map((agent) => agent.code)).toContain("supervisor");
    expect(getAgentDefinition("support").label).toContain("Support");
    expect(AI_TOOL_REGISTRY.length).toBe(
      CUSTOMER_SUPPORT_TOOL_NAMES.length + CODING_TOOL_NAMES.length,
    );
    expect(getTool("searchKnowledge")?.risk).toBe("read");
    expect(getTool("createTicket")?.risk).toBe("write");
    expect(getTool("createPullRequests")?.requiresApproval).toBe(true);
    expect(chunkText("hello world", 5).length).toBeGreaterThan(1);
    expect(DEFAULT_MEMORY_POLICIES[0]?.scope).toBe("conversation");
    expect(scorePlaceholder("case_1").passed).toBe(false);
    expect(requiresApproval("destructive", false)).toBe(true);
    expect(requiresApproval("write", false)).toBe(false);
    expect(DEFAULT_AI_SECURITY_POLICY.enabled).toBe(true);
    expect(clampMaxTokens(99_999)).toBe(DEFAULT_AI_SECURITY_POLICY.maxTokensPerRequest);
    expect(() => assertAiEnabled({ ...DEFAULT_AI_SECURITY_POLICY, enabled: false })).toThrow(
      /disabled/i,
    );
  });

  it("registers customer support tools on the support agent", () => {
    expect([...CUSTOMER_SUPPORT_TOOL_NAMES]).toEqual([
      "getCurrentCustomer",
      "getCustomerServices",
      "getCustomerDomains",
      "getCustomerHosting",
      "getCustomerInvoices",
      "getCustomerTickets",
      "searchKnowledge",
      "createTicket",
      "replyTicket",
    ]);
    expect(getAgentDefinition("support").toolAllowlist).toEqual([
      ...CUSTOMER_SUPPORT_TOOL_NAMES,
    ]);
    expect(getTool("replyTicket")?.parameters.body?.required).toBe(true);
  });

  it("registers coding tools on the coding agent", () => {
    expect([...CODING_TOOL_NAMES]).toEqual([
      "readRepository",
      "searchCode",
      "explainCode",
      "diagnoseErrors",
      "generateCode",
      "generateTests",
      "runTests",
      "reviewChanges",
      "createBranches",
      "createPullRequests",
    ]);
    expect(getAgentDefinition("coding").toolAllowlist).toEqual([...CODING_TOOL_NAMES]);
    expect(getTool("createBranches")?.requiresApproval).toBe(true);
    expect(requiresApproval("write", true)).toBe(true);
  });

  it("encodes the Coding AI delivery pipeline through Deploy", () => {
    expect([...CODING_PIPELINE_STAGES]).toEqual([
      "ai_code",
      "branch",
      "test",
      "pull_request",
      "human_review",
      "merge",
      "deploy",
    ]);
    expect(CODING_PIPELINE_DIAGRAM).toContain("HUMAN REVIEW");
    expect(getNextCodingPipelineStage("ai_code")).toBe("branch");
    expect(getNextCodingPipelineStage("pull_request")).toBe("human_review");
    expect(getNextCodingPipelineStage("deploy")).toBeNull();
    expect(canCodingAiActAtStage("test")).toBe(true);
    expect(canCodingAiActAtStage("human_review")).toBe(false);
    expect(canCodingAiActAtStage("merge")).toBe(false);
    expect(canCodingAiActAtStage("deploy")).toBe(false);
  });

  it("invokeTool fails loudly until domain handlers are bound", async () => {
    await expect(
      invokeTool(
        "getCurrentCustomer",
        {},
        { organizationId: "org_1", userId: "user_1", customerId: "cust_1" },
      ),
    ).rejects.toBeInstanceOf(AiToolUnwiredError);
    await expect(
      invokeTool(
        "readRepository",
        { path: "packages/ai" },
        { organizationId: "org_1", userId: "user_1", projectId: "proj_1" },
      ),
    ).rejects.toBeInstanceOf(AiToolUnwiredError);
  });

  it("encodes the AI Supervisor org chart", () => {
    expect(AI_AGENT_CODES).toEqual([
      "supervisor",
      "support",
      "coding",
      "hosting",
      "sales",
      "seo",
      "knowledge",
    ]);
    expect(getAgentDefinition("supervisor").reportsTo).toBeNull();
    expect(listSpecialists().map((a) => a.code)).toEqual([
      "support",
      "coding",
      "hosting",
      "sales",
      "seo",
      "knowledge",
    ]);
    expect(listAgentsByTier("primary").map((a) => a.code)).toEqual([
      "support",
      "coding",
      "hosting",
    ]);
    expect(listAgentsByTier("cross_cutting").map((a) => a.code)).toEqual(["sales"]);
    expect(listAgentsByTier("specialty").map((a) => a.code)).toEqual([
      "seo",
      "knowledge",
    ]);
    expect(AI_ORG_CHART).toContain("AI SUPERVISOR");
    expect(AI_ORG_CHART).toContain("Knowledge");
  });

  it("knowledge search PLACEHOLDER returns empty until VectorStore is bound", async () => {
    await expect(searchKnowledge({ query: "ssl" })).resolves.toEqual([]);
  });
});

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
    const llm = new OpenAiLlmProvider(
      { apiKey: "sk-test", defaultModel: "gpt-4o-mini" },
      transport,
    );
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
