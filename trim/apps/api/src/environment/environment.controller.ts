import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  alertRuleSchema,
  createAlertRuleSchema,
  createReadingSchema,
  environmentalReadingSchema,
  importReadingsResultSchema,
  importReadingsSchema,
  type AlertRule,
  type CreateAlertRule,
  type CreateReading,
  type EnvironmentalReading,
  type ImportReadings,
  type ImportReadingsResult,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EnvironmentService } from './environment.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnvironmentController {
  constructor(private readonly environment: EnvironmentService) {}

  @Post('rooms/:roomId/readings')
  @RequirePermissions('rooms.write')
  async createReading(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createReadingSchema)) body: CreateReading,
  ): Promise<EnvironmentalReading> {
    const reading = await this.environment.createReading(user, roomId, body);
    return environmentalReadingSchema.parse(reading);
  }

  @Post('rooms/:roomId/readings/import')
  @RequirePermissions('rooms.write')
  async importReadings(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(importReadingsSchema)) body: ImportReadings,
  ): Promise<ImportReadingsResult> {
    const result = await this.environment.importCsv(user, roomId, body.csv);
    return importReadingsResultSchema.parse(result);
  }

  @Post('rooms/:roomId/alert-rules')
  @RequirePermissions('rooms.write')
  async createRule(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createAlertRuleSchema)) body: CreateAlertRule,
  ): Promise<AlertRule> {
    const rule = await this.environment.createRule(user, roomId, body);
    return alertRuleSchema.parse(rule);
  }

  @Get('readings/:readingId')
  @RequirePermissions('rooms.read')
  async getReading(
    @CurrentUser() user: SessionUser,
    @Param('readingId') readingId: string,
  ): Promise<EnvironmentalReading> {
    const reading = await this.environment.getReading(user, readingId);
    return environmentalReadingSchema.parse(reading);
  }
}
