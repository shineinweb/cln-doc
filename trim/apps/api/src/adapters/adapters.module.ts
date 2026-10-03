import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentModule } from '../environment/environment.module';
import { ControllerAdapterController } from './controller-adapter.controller';
import { ControllerAdapterService } from './controller-adapter.service';
import { EnvironmentGatewayController } from './environment-gateway.controller';
import { EnvironmentGatewayService } from './environment-gateway.service';
import { ScaleAdapterController } from './scale-adapter.controller';
import { ScaleAdapterService } from './scale-adapter.service';
import { TagAdapterController } from './tag-adapter.controller';
import { TagAdapterService } from './tag-adapter.service';

@Module({
  imports: [AuthModule, EnvironmentModule],
  controllers: [EnvironmentGatewayController, ControllerAdapterController, ScaleAdapterController, TagAdapterController],
  providers: [EnvironmentGatewayService, ControllerAdapterService, ScaleAdapterService, TagAdapterService],
})
export class AdaptersModule {}
