import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentModule } from '../environment/environment.module';
import { FacilitiesModule } from '../facilities/facilities.module';
import { ReportsModule } from '../reports/reports.module';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';

@Module({
  imports: [AuthModule, EnvironmentModule, FacilitiesModule, ReportsModule],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
