import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ipmInputSchema,
  irrigationInputSchema,
  maintenanceInputSchema,
  operationsOverviewSchema,
  purchaseInputSchema,
  recurringInputSchema,
  recurringViewSchema,
  roomStayInputSchema,
  sanitationInputSchema,
  sopLibrarySchema,
  trainingInputSchema,
  type IpmInput,
  type IrrigationInput,
  type MaintenanceInput,
  type PurchaseInput,
  type RecurringInput,
  type RoomStayInput,
  type SanitationInput,
  type SessionUser,
  type TrainingInput,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('sop-library')
  async library(@CurrentUser() user: SessionUser) {
    return sopLibrarySchema.parse(await this.operations.library(user));
  }

  @Get('sites/:siteId')
  async overview(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string) {
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/irrigation')
  async irrigation(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(irrigationInputSchema)) body: IrrigationInput,
  ) {
    await this.operations.addIrrigation(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/ipm')
  async ipm(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(ipmInputSchema)) body: IpmInput,
  ) {
    await this.operations.addIpm(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/maintenance')
  async maintenance(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(maintenanceInputSchema)) body: MaintenanceInput,
  ) {
    await this.operations.addMaintenance(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/purchasing')
  async purchasing(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(purchaseInputSchema)) body: PurchaseInput,
  ) {
    await this.operations.addPurchase(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/sanitation')
  async sanitation(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(sanitationInputSchema)) body: SanitationInput,
  ) {
    await this.operations.addSanitation(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/training')
  async training(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(trainingInputSchema)) body: TrainingInput,
  ) {
    await this.operations.addTraining(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/stays')
  async stay(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(roomStayInputSchema)) body: RoomStayInput,
  ) {
    await this.operations.addStay(user, siteId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Post('sites/:siteId/recurring')
  async recurring(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(recurringInputSchema)) body: RecurringInput,
  ) {
    return recurringViewSchema.parse(await this.operations.addRecurring(user, siteId, body));
  }

  @Post('sites/:siteId/recurring/:dutyId/complete')
  async complete(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('dutyId') dutyId: string,
  ) {
    return recurringViewSchema.parse(await this.operations.completeRecurring(user, siteId, dutyId));
  }

  @Patch('sites/:siteId/irrigation/:recordId')
  async editIrrigation(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(irrigationInputSchema)) body: IrrigationInput,
  ) {
    await this.operations.updateIrrigation(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/ipm/:recordId')
  async editIpm(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(ipmInputSchema)) body: IpmInput,
  ) {
    await this.operations.updateIpm(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/maintenance/:recordId')
  async editMaintenance(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(maintenanceInputSchema)) body: MaintenanceInput,
  ) {
    await this.operations.updateMaintenance(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/purchasing/:recordId')
  async editPurchase(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(purchaseInputSchema)) body: PurchaseInput,
  ) {
    await this.operations.updatePurchase(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/sanitation/:recordId')
  async editSanitation(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(sanitationInputSchema)) body: SanitationInput,
  ) {
    await this.operations.updateSanitation(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/training/:recordId')
  async editTraining(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(trainingInputSchema)) body: TrainingInput,
  ) {
    await this.operations.updateTraining(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/stays/:recordId')
  async editStay(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(roomStayInputSchema)) body: RoomStayInput,
  ) {
    await this.operations.updateStay(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Patch('sites/:siteId/recurring/:recordId')
  async editRecurring(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('recordId') recordId: string,
    @Body(new ZodValidationPipe(recurringInputSchema)) body: RecurringInput,
  ) {
    await this.operations.updateRecurring(user, siteId, recordId, body);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }

  @Delete('sites/:siteId/:kind/:recordId')
  async remove(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('kind') kind: string,
    @Param('recordId') recordId: string,
  ) {
    const allowed = ['irrigation', 'ipm', 'maintenance', 'purchasing', 'sanitation', 'training', 'stays', 'recurring'] as const;
    if (!allowed.includes(kind as (typeof allowed)[number])) {
      throw new BadRequestException('That list is not on this facility.');
    }
    await this.operations.deleteRecord(user, siteId, kind as (typeof allowed)[number], recordId);
    return operationsOverviewSchema.parse(await this.operations.overview(user, siteId));
  }
}
