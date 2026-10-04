import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import {
  laborRateInputSchema,
  laborRateViewSchema,
  payrollAnswerSchema,
  payrollAskSchema,
  payrollReportSchema,
  timeClockStatusSchema,
  timePresenceListSchema,
  timePunchInputSchema,
  timePunchSchema,
  type LaborRateInput,
  type LaborRateView,
  type PayrollAnswer,
  type PayrollAsk,
  type PayrollReport,
  type SessionUser,
  type TimeClockStatus,
  type TimePresenceList,
  type TimePunch,
  type TimePunchInput,
} from '@trim/contracts';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TimeclockService } from './timeclock.service';

const dateQuery = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

@Controller('timeclock')
@UseGuards(JwtAuthGuard)
export class TimeclockController {
  constructor(private readonly timeclock: TimeclockService) {}

  @Get('status')
  async status(
    @CurrentUser() user: SessionUser,
    @Query('siteId') siteId?: string,
  ): Promise<TimeClockStatus> {
    return timeClockStatusSchema.parse(await this.timeclock.status(user, siteId || null));
  }

  @Post('punch')
  @HttpCode(200)
  async punch(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(timePunchInputSchema)) body: TimePunchInput,
  ): Promise<TimeClockStatus> {
    return timeClockStatusSchema.parse(await this.timeclock.punch(user, body));
  }

  @Get('presence')
  async presence(
    @CurrentUser() user: SessionUser,
    @Query('siteId') siteId?: string,
  ): Promise<TimePresenceList> {
    return timePresenceListSchema.parse(await this.timeclock.presence(user, siteId || null));
  }

  @Get('timecard')
  async timecard(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('userId') userId?: string,
    @Query('siteId') siteId?: string,
  ): Promise<TimePunch[]> {
    const periodStart = dateQuery.parse(from);
    const periodEnd = dateQuery.parse(to);
    if (!periodStart || !periodEnd) {
      throw new BadRequestException('from and to are required as YYYY-MM-DD');
    }
    return z
      .array(timePunchSchema)
      .parse(await this.timeclock.timecard(user, periodStart, periodEnd, userId || null, siteId || null));
  }

  @Get('rates')
  async rates(@CurrentUser() user: SessionUser): Promise<LaborRateView[]> {
    return z.array(laborRateViewSchema).parse(await this.timeclock.listRates(user));
  }

  @Post('rates')
  @HttpCode(200)
  async saveRate(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(laborRateInputSchema)) body: LaborRateInput,
  ): Promise<LaborRateView> {
    return laborRateViewSchema.parse(await this.timeclock.saveRate(user, body));
  }

  @Get('payroll')
  async payroll(
    @CurrentUser() user: SessionUser,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('siteId') siteId?: string,
  ): Promise<PayrollReport> {
    const periodStart = dateQuery.parse(from);
    const periodEnd = dateQuery.parse(to);
    if (!periodStart || !periodEnd) {
      throw new BadRequestException('from and to are required as YYYY-MM-DD');
    }
    return payrollReportSchema.parse(await this.timeclock.payroll(user, periodStart, periodEnd, siteId || null));
  }

  @Post('payroll/ask')
  @HttpCode(200)
  async ask(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(payrollAskSchema)) body: PayrollAsk,
  ): Promise<PayrollAnswer> {
    return payrollAnswerSchema.parse(await this.timeclock.askPayroll(user, body));
  }
}
