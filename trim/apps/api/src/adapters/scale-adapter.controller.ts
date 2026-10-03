import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  scaleSampleSchema,
  scaleSampleViewSchema,
  type ScaleSampleInput,
  type ScaleSampleView,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ScaleAdapterService } from './scale-adapter.service';

const scaleListSchema = z.array(scaleSampleViewSchema);

@Controller('adapters/scales')
@UseGuards(JwtAuthGuard)
export class ScaleAdapterController {
  constructor(private readonly scales: ScaleAdapterService) {}

  @Get('harvests/:harvestId/samples')
  async list(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string): Promise<ScaleSampleView[]> {
    return scaleListSchema.parse(await this.scales.list(user, harvestId));
  }

  @Post('harvests/:harvestId/samples')
  async postSample(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(scaleSampleSchema)) body: ScaleSampleInput,
  ): Promise<ScaleSampleView> {
    return scaleSampleViewSchema.parse(await this.scales.postSample(user, harvestId, body));
  }
}
