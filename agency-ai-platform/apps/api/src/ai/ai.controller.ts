import { Body, Controller, Inject, Post, ServiceUnavailableException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AiService, LlmProviderUnwiredError, type LlmCompletionResponse } from "@agency/ai";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Permissions } from "../common/decorators/permissions.decorator";
import type { AuthUserView } from "@agency/auth";
import { AI_SERVICE } from "./ai.constants";
import { CompleteDto } from "./dto/complete.dto";

/**
 * Nest AI HTTP surface for React clients.
 * Stack: React → NestJS API → AiService → LLMProvider → OpenAI transport
 */
@Controller("ai")
export class AiController {
  constructor(@Inject(AI_SERVICE) private readonly aiService: AiService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Permissions("ai.use")
  @Post("complete")
  async complete(
    @Body() dto: CompleteDto,
    @CurrentUser() user: AuthUserView,
  ): Promise<{ data: LlmCompletionResponse & { requestedBy: string } }> {
    try {
      const result = await this.aiService.complete({
        model: dto.model ?? "gpt-4o-mini",
        messages: dto.messages,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
      });
      return {
        data: {
          ...result,
          requestedBy: user.id,
        },
      };
    } catch (error) {
      if (error instanceof LlmProviderUnwiredError) {
        throw new ServiceUnavailableException({
          title: "AI provider not configured",
          detail:
            "OpenAI transport is PLACEHOLDER. Nest AiService is wired; inject a live OpenAiApiTransport to enable completions.",
          code: "AI_PROVIDER_UNWIRED",
        });
      }
      throw error;
    }
  }
}
