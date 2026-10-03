import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  trolmasterChartSchema,
  trolmasterConnectionSchema,
  trolmasterInputSchema,
  trolmasterModeSchema,
  type SessionUser,
  type TrolmasterChart,
  type TrolmasterConnection,
  type TrolmasterInput,
  type TrolmasterMode,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TrolmasterService } from './trolmaster.service';

const trolmasterListSchema = z.array(trolmasterConnectionSchema);

@Controller('sites/:siteId/trolmaster')
@UseGuards(JwtAuthGuard)
export class TrolmasterController {
  constructor(private readonly trolmaster: TrolmasterService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<TrolmasterConnection[]> {
    return trolmasterListSchema.parse(await this.trolmaster.list(user, siteId));
  }

  @Post()
  async save(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(trolmasterInputSchema)) body: TrolmasterInput,
  ): Promise<TrolmasterConnection> {
    return trolmasterConnectionSchema.parse(await this.trolmaster.save(user, siteId, body));
  }
}

@Controller('rooms/:roomId/trolmaster')
@UseGuards(JwtAuthGuard)
export class TrolmasterChartController {
  constructor(private readonly trolmaster: TrolmasterService) {}

  @Get('chart')
  async chart(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string): Promise<TrolmasterChart> {
    return trolmasterChartSchema.parse(await this.trolmaster.chart(user, roomId));
  }

  @Patch()
  async mode(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(trolmasterModeSchema)) body: TrolmasterMode,
  ): Promise<TrolmasterMode> {
    return trolmasterModeSchema.parse(await this.trolmaster.setMode(user, roomId, body));
  }
}
