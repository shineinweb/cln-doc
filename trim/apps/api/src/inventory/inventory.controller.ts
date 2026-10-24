import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  changePlantStageSchema,
  metrcInventoryPayloadSchema,
  movePlantSchema,
  plantObservationSchema,
  type ChangePlantStage,
  type MetrcInventoryPayload,
  type MovePlant,
  type PlantObservation,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('compliance')
  @RequirePermissions('compliance.read', 'inventory.read')
  compliance(@CurrentUser() user: SessionUser) {
    return this.inventory.compliance(user);
  }

  @Get('licenses/:licenseId')
  @RequirePermissions('inventory.read')
  license(
    @CurrentUser() user: SessionUser,
    @Param('licenseId') licenseId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '5',
  ) {
    return this.inventory.licenseInventory(user, licenseId, page, pageSize);
  }

  @Post('licenses/:licenseId/imports')
  @RequirePermissions('inventory.write')
  importFile(
    @CurrentUser() user: SessionUser,
    @Param('licenseId') licenseId: string,
    @Body(new ZodValidationPipe(metrcInventoryPayloadSchema)) body: MetrcInventoryPayload,
  ) {
    return this.inventory.importInventory(user, licenseId, body);
  }

  @Get('plants/:plantId')
  @RequirePermissions('inventory.read')
  plant(@CurrentUser() user: SessionUser, @Param('plantId') plantId: string) {
    return this.inventory.plantDetail(user, plantId);
  }

  @Post('plants/:plantId/moves')
  @RequirePermissions('inventory.write')
  move(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(movePlantSchema)) body: MovePlant,
  ) {
    return this.inventory.move(user, plantId, body);
  }

  @Post('plants/:plantId/stages')
  @RequirePermissions('inventory.write')
  stage(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(changePlantStageSchema)) body: ChangePlantStage,
  ) {
    return this.inventory.changeStage(user, plantId, body);
  }

  @Post('plants/:plantId/observations')
  @RequirePermissions('inventory.write')
  observe(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(plantObservationSchema)) body: PlantObservation,
  ) {
    return this.inventory.observe(user, plantId, body);
  }
}
