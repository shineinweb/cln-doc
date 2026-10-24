import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { CropCycleDetail, SessionUser } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CyclesService } from './cycles.service';

@Controller('cycles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('tasks.read', 'rooms.read')
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get(':cycleId')
  get(@CurrentUser() user: SessionUser, @Param('cycleId') cycleId: string): Promise<CropCycleDetail> {
    return this.cycles.getCycle(user, cycleId);
  }
}
