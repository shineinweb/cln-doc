import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AccessController],
  providers: [AccessService],
})
export class AccessModule {}
