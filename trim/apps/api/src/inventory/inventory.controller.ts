import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { InventoryService } from './inventory.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('compliance')
  compliance(@CurrentUser() user: SessionUser) {
    return this.inventory.compliance(user);
  }

  @Get('licenses/:licenseId')
  license(@CurrentUser() user: SessionUser, @Param('licenseId') licenseId: string) {
    return this.inventory.licenseInventory(user, licenseId);
  }

  @Post('licenses/:licenseId/imports')
  importFile(
    @CurrentUser() user: SessionUser,
    @Param('licenseId') licenseId: string,
    @Body(new ZodValidationPipe(metrcInventoryPayloadSchema)) body: MetrcInventoryPayload,
  ) {
    return this.inventory.importInventory(user, licenseId, body);
  }

  @Get('plants/:plantId')
  plant(@CurrentUser() user: SessionUser, @Param('plantId') plantId: string) {
    return this.inventory.plantDetail(user, plantId);
  }

  @Post('plants/:plantId/moves')
  move(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(movePlantSchema)) body: MovePlant,
  ) {
    return this.inventory.move(user, plantId, body);
  }

  @Post('plants/:plantId/stages')
  stage(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(changePlantStageSchema)) body: ChangePlantStage,
  ) {
    return this.inventory.changeStage(user, plantId, body);
  }

  @Post('plants/:plantId/observations')
  observe(
    @CurrentUser() user: SessionUser,
    @Param('plantId') plantId: string,
    @Body(new ZodValidationPipe(plantObservationSchema)) body: PlantObservation,
  ) {
    return this.inventory.observe(user, plantId, body);
  }
}
