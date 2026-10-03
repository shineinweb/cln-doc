import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  controllerReadingSchema,
  controllerSampleSchema,
  type ControllerReading,
  type ControllerSample,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ControllerAdapterService } from './controller-adapter.service';

const controllerListSchema = z.array(controllerReadingSchema);

@Controller('adapters/controllers')
@UseGuards(JwtAuthGuard)
export class ControllerAdapterController {
  constructor(private readonly controllers: ControllerAdapterService) {}

  @Get('rooms/:roomId/samples')
  async list(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string): Promise<ControllerReading[]> {
    return controllerListSchema.parse(await this.controllers.list(user, roomId));
  }

  @Post('rooms/:roomId/samples')
  async postSample(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(controllerSampleSchema)) body: ControllerSample,
  ): Promise<ControllerReading> {
    return controllerReadingSchema.parse(await this.controllers.postSample(user, roomId, body));
  }
}
