import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  assignCyclePlantsSchema,
  type AssignCyclePlants,
  type CropCycleDetail,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CyclesService } from './cycles.service';

@Controller('cycles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get(':cycleId')
  @RequirePermissions('tasks.read', 'rooms.read')
  get(@CurrentUser() user: SessionUser, @Param('cycleId') cycleId: string): Promise<CropCycleDetail> {
    return this.cycles.getCycle(user, cycleId);
  }

  @Post(':cycleId/plants')
  @RequirePermissions('inventory.write', 'harvests.write')
  assignPlants(
    @CurrentUser() user: SessionUser,
    @Param('cycleId') cycleId: string,
    @Body(new ZodValidationPipe(assignCyclePlantsSchema)) body: AssignCyclePlants,
  ): Promise<CropCycleDetail> {
    return this.cycles.assignPlants(user, cycleId, body);
  }
}
