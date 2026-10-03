import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
}
