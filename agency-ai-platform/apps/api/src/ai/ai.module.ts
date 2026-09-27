import { Module } from "@nestjs/common";
import {
  AiService,
  OpenAiLlmProvider,
  UnwiredOpenAiApiTransport,
} from "@agency/ai";
import { AiController } from "./ai.controller";
import { AI_SERVICE } from "./ai.constants";

/**
 * Wires React → Nest → AiService → OpenAiLlmProvider.
 * Live OpenAI HTTP remains PLACEHOLDER (UnwiredOpenAiApiTransport).
 */
@Module({
  controllers: [AiController],
  providers: [
    {
      provide: AI_SERVICE,
      useFactory: (): AiService => {
        const apiKey = process.env.OPENAI_API_KEY?.trim() || "unwired";
        const llm = new OpenAiLlmProvider(
          { apiKey, defaultModel: "gpt-4o-mini" },
          new UnwiredOpenAiApiTransport(),
        );
        return new AiService({ llm });
      },
    },
  ],
  exports: [AI_SERVICE],
})
export class AiModule {}
