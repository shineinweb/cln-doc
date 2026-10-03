import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentController } from './environment.controller';
import { EnvironmentService } from './environment.service';

@Module({
  imports: [AuthModule],
  controllers: [EnvironmentController],
  providers: [EnvironmentService],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}
