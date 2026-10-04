import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  trolmasterChartSchema,
  trolmasterConnectionSchema,
  trolmasterInputSchema,
  trolmasterModeSchema,
  trolmasterRangeSchema,
  type SessionUser,
  type TrolmasterChart,
  type TrolmasterConnection,
  type TrolmasterInput,
  type TrolmasterMode,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TrolmasterService } from './trolmaster.service';

const trolmasterListSchema = z.array(trolmasterConnectionSchema);

@Controller('sites/:siteId/trolmaster')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrolmasterController {
  constructor(private readonly trolmaster: TrolmasterService) {}

  @Get()
  @RequirePermissions('rooms.read', 'settings.manage')
  async list(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<TrolmasterConnection[]> {
    return trolmasterListSchema.parse(await this.trolmaster.list(user, siteId));
  }

  @Post()
  @RequirePermissions('settings.manage')
  async save(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(trolmasterInputSchema)) body: TrolmasterInput,
  ): Promise<TrolmasterConnection> {
    return trolmasterConnectionSchema.parse(await this.trolmaster.save(user, siteId, body));
  }
}

@Controller('rooms/:roomId/trolmaster')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TrolmasterChartController {
  constructor(private readonly trolmaster: TrolmasterService) {}

  @Get('chart')
  @RequirePermissions('rooms.read')
  async chart(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Query('range') range?: string,
  ): Promise<TrolmasterChart> {
    const parsed = trolmasterRangeSchema.safeParse(range ?? 'day');
    return trolmasterChartSchema.parse(await this.trolmaster.chart(user, roomId, parsed.success ? parsed.data : 'day'));
  }

  @Patch()
  @RequirePermissions('rooms.write', 'settings.manage')
  async mode(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(trolmasterModeSchema)) body: TrolmasterMode,
  ): Promise<TrolmasterMode> {
    return trolmasterModeSchema.parse(await this.trolmaster.setMode(user, roomId, body));
  }
}
