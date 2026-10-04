import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  messageDirectorySchema,
  messageThreadDetailSchema,
  messageThreadListSchema,
  openAiThreadSchema,
  openDirectThreadSchema,
  sendMessageInputSchema,
  type OpenAiThread,
  type OpenDirectThread,
  type SendMessageInput,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('directory')
  async directory(@CurrentUser() user: SessionUser) {
    return messageDirectorySchema.parse(await this.messages.directory(user));
  }

  @Get('threads')
  async listThreads(@CurrentUser() user: SessionUser) {
    return messageThreadListSchema.parse(await this.messages.listThreads(user));
  }

  @Post('threads/direct')
  async openDirect(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(openDirectThreadSchema)) body: OpenDirectThread,
  ) {
    return messageThreadDetailSchema.parse(await this.messages.openDirect(user, body));
  }

  @Post('threads/ai')
  async openAi(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(openAiThreadSchema)) body: OpenAiThread,
  ) {
    return messageThreadDetailSchema.parse(await this.messages.openAi(user, body));
  }

  @Get('threads/:threadId')
  async getThread(@CurrentUser() user: SessionUser, @Param('threadId') threadId: string) {
    return messageThreadDetailSchema.parse(await this.messages.getThread(user, threadId));
  }

  @Post('threads/:threadId/messages')
  async send(
    @CurrentUser() user: SessionUser,
    @Param('threadId') threadId: string,
    @Body(new ZodValidationPipe(sendMessageInputSchema)) body: SendMessageInput,
  ) {
    return messageThreadDetailSchema.parse(await this.messages.send(user, threadId, body));
  }
}
