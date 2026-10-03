import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  tagSampleSchema,
  tagSampleViewSchema,
  type SessionUser,
  type TagSampleInput,
  type TagSampleView,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TagAdapterService } from './tag-adapter.service';

@Controller('adapters/tags')
@UseGuards(JwtAuthGuard)
export class TagAdapterController {
  constructor(private readonly tags: TagAdapterService) {}

  @Get('harvests/:harvestId/samples')
  async list(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string): Promise<TagSampleView[]> {
    return z.array(tagSampleViewSchema).parse(await this.tags.list(user, harvestId));
  }

  @Post('harvests/:harvestId/samples')
  async postSample(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(tagSampleSchema)) body: TagSampleInput,
  ): Promise<TagSampleView> {
    return tagSampleViewSchema.parse(await this.tags.postSample(user, harvestId, body));
  }
}
