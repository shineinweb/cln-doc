import { Module } from '@nestjs/common';
import { AccessModule } from './access/access.module';
import { AdaptersModule } from './adapters/adapters.module';
import { AuthModule } from './auth/auth.module';
import { CoachModule } from './coach/coach.module';
import { CyclesModule } from './cycles/cycles.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HarvestsModule } from './harvests/harvests.module';
import { InventoryModule } from './inventory/inventory.module';
import { MessagesModule } from './messages/messages.module';
import { OperationsModule } from './operations/operations.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RecordsModule } from './records/records.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TimeclockModule } from './timeclock/timeclock.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    AuthModule,
    AccessModule,
    CyclesModule,
    FacilitiesModule,
    WorkflowsModule,
    SubmissionsModule,
    InventoryModule,
    HarvestsModule,
    ReportsModule,
    CoachModule,
    MessagesModule,
    AdaptersModule,
    OperationsModule,
    RecordsModule,
    TimeclockModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
