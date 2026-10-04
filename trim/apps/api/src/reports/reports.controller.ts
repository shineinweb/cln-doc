import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  comparisonReportSchema,
  dashboardAnalyticsSchema,
  siteReportSchema,
  type ComparisonReport,
  type DashboardAnalytics,
  type SessionUser,
  type SiteReport,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('comparison')
  async comparison(@CurrentUser() user: SessionUser): Promise<ComparisonReport> {
    return comparisonReportSchema.parse(await this.reports.comparison(user));
  }

  @Get('sites/:siteId/dashboard')
  async dashboard(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<DashboardAnalytics> {
    return dashboardAnalyticsSchema.parse(await this.reports.dashboard(user, siteId));
  }

  @Get('sites/:siteId')
  async site(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<SiteReport> {
    return siteReportSchema.parse(await this.reports.siteReport(user, siteId));
  }
}
