import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule, SubmissionsModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
