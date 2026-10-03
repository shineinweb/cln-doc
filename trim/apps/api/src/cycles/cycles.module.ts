import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentModule } from '../environment/environment.module';
import { CyclesController } from './cycles.controller';
import { CyclesService } from './cycles.service';

@Module({
  imports: [AuthModule, EnvironmentModule],
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}