import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule, AuthModule, FacilitiesModule],
  controllers: [HealthController],
})
export class AppModule {}
