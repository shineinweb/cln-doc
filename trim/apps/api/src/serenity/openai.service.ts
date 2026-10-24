import { Injectable, Logger } from '@nestjs/common';
import { loadEnv } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { SERENITY_SYSTEM_PROMPT } from './serenity';

export type SerenityChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  async complete(
    organizationId: string,
    messages: SerenityChatMessage[],
    options?: { temperature?: number },
  ): Promise<string | null> {
    const config = await this.resolveConfig(organizationId);
    if (!config) {
      return null;
    }
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: options?.temperature ?? 0.3,
          messages: [{ role: 'system', content: SERENITY_SYSTEM_PROMPT }, ...messages],
        }),
      });
      if (!response.ok) {
        const detail = await response.text();
        this.logger.warn(`OpenAI chat failed (${response.status}): ${detail.slice(0, 300)}`);
        return null;
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      return content || null;
    } catch (error) {
      this.logger.warn(`OpenAI chat error: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async isConfigured(organizationId: string): Promise<boolean> {
    return Boolean(await this.resolveConfig(organizationId));
  }

  private async resolveConfig(organizationId: string): Promise<{ apiKey: string; model: string } | null> {
    const stored = await this.prisma.openAiApiSetting.findUnique({ where: { organizationId } });
    if (stored?.apiKey) {
      return { apiKey: stored.apiKey, model: stored.model || 'gpt-4o-mini' };
    }
    const envKey = loadEnv().OPENAI_API_KEY?.trim();
    if (envKey) {
      return { apiKey: envKey, model: loadEnv().OPENAI_MODEL || 'gpt-4o-mini' };
    }
    return null;
  }
}
