import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  coachAnswerSchema,
  coachChatRequestSchema,
  coachChatResponseSchema,
  coachQuestionSchema,
  siteCoachSchema,
  type CoachAnswer,
  type CoachChatRequest,
  type CoachChatResponse,
  type SessionUser,
  type SiteCoach,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CoachService } from './coach.service';

@Controller('sites/:siteId/coach')
@UseGuards(JwtAuthGuard)
export class CoachController {
  constructor(private readonly coach: CoachService) {}

  @Get()
  async show(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<SiteCoach> {
    return siteCoachSchema.parse(await this.coach.forSite(user, siteId));
  }

  @Post('ask')
  async ask(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(coachQuestionSchema)) body: { question: string },
  ): Promise<CoachAnswer> {
    return coachAnswerSchema.parse(await this.coach.ask(user, siteId, body.question));
  }

  @Post('chat')
  async chat(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(coachChatRequestSchema)) body: CoachChatRequest,
  ): Promise<CoachChatResponse> {
    return coachChatResponseSchema.parse(await this.coach.chat(user, siteId, body));
  }
}
