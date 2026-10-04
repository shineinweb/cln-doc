import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  createHarvestSchema,
  createPackageSchema,
  recordWasteSchema,
  recordWeightSchema,
  startDryingSchema,
  type CreateHarvest,
  type CreatePackage,
  type RecordWaste,
  type RecordWeight,
  type SessionUser,
  type StartDrying,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HarvestsService } from './harvests.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HarvestsController {
  constructor(private readonly harvests: HarvestsService) {}

  @Get('harvests')
  @RequirePermissions('harvests.read')
  list(@CurrentUser() user: SessionUser) {
    return this.harvests.list(user);
  }

  @Post('harvests')
  @RequirePermissions('harvests.write')
  create(@CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(createHarvestSchema)) body: CreateHarvest) {
    return this.harvests.create(user, body);
  }

  @Get('harvests/:harvestId/waste')
  @RequirePermissions('harvests.read')
  waste(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string) {
    return this.harvests.listWaste(user, harvestId);
  }

  @Get('harvests/:harvestId')
  @RequirePermissions('harvests.read')
  getOne(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string) {
    return this.harvests.getOne(user, harvestId);
  }

  @Post('harvests/:harvestId/wet-weight')
  @RequirePermissions('harvests.write')
  wet(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(recordWeightSchema)) body: RecordWeight,
  ) {
    return this.harvests.recordWetWeight(user, harvestId, body);
  }

  @Post('harvests/:harvestId/drying')
  @RequirePermissions('harvests.write')
  drying(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(startDryingSchema)) body: StartDrying,
  ) {
    return this.harvests.startDrying(user, harvestId, body);
  }

  @Post('harvests/:harvestId/dry-weight')
  @RequirePermissions('harvests.write')
  dry(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(recordWeightSchema)) body: RecordWeight,
  ) {
    return this.harvests.recordDryWeight(user, harvestId, body);
  }

  @Post('harvests/:harvestId/trimming')
  @RequirePermissions('harvests.write')
  trim(@CurrentUser() user: SessionUser, @Param('harvestId') harvestId: string) {
    return this.harvests.recordTrimming(user, harvestId);
  }

  @Post('harvests/:harvestId/waste')
  @RequirePermissions('harvests.write')
  recordWaste(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(recordWasteSchema)) body: RecordWaste,
  ) {
    return this.harvests.recordWaste(user, harvestId, body);
  }

  @Post('harvests/:harvestId/packages')
  @RequirePermissions('harvests.write')
  createPackage(
    @CurrentUser() user: SessionUser,
    @Param('harvestId') harvestId: string,
    @Body(new ZodValidationPipe(createPackageSchema)) body: CreatePackage,
  ) {
    return this.harvests.createPackage(user, harvestId, body);
  }

  @Get('packages/:packageId')
  @RequirePermissions('harvests.read')
  getPackage(@CurrentUser() user: SessionUser, @Param('packageId') packageId: string) {
    return this.harvests.getPackage(user, packageId);
  }
}
