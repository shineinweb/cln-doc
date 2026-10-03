import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CyclesModule } from './cycles/cycles.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HarvestsModule } from './harvests/harvests.module';
import { InventoryModule } from './inventory/inventory.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, CyclesModule, FacilitiesModule, WorkflowsModule, SubmissionsModule, InventoryModule, HarvestsModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
