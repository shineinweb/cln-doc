import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnvironmentModule } from '../environment/environment.module';
import { ControllerAdapterController } from './controller-adapter.controller';
import { ControllerAdapterService } from './controller-adapter.service';
import { EnvironmentGatewayController } from './environment-gateway.controller';
import { EnvironmentGatewayService } from './environment-gateway.service';
import { ScaleAdapterController } from './scale-adapter.controller';
import { ScaleAdapterService } from './scale-adapter.service';

@Module({
  imports: [AuthModule, EnvironmentModule],
  controllers: [EnvironmentGatewayController, ControllerAdapterController, ScaleAdapterController],
  providers: [EnvironmentGatewayService, ControllerAdapterService, ScaleAdapterService],
})
export class AdaptersModule {}
