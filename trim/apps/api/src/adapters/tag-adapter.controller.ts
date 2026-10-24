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
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TagAdapterService } from './tag-adapter.service';

@Controller('adapters/tags')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TagAdapterController {
  constructor(private readonly tags: TagAdapterService) {}

  @Get('harvests/:harvestId/samples')
  @RequirePermissions('harvests.read')
  async list(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string): Promise<TagSampleView[]> {
    return z.array(tagSampleViewSchema).parse(await this.tags.list(user, harvestId));
  }

  @Post('harvests/:harvestId/samples')
  @RequirePermissions('harvests.write')
  async postSample(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(tagSampleSchema)) body: TagSampleInput,
  ): Promise<TagSampleView> {
    return tagSampleViewSchema.parse(await this.tags.postSample(user, harvestId, body));
  }
}
