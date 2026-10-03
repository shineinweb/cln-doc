import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CyclesModule } from '../cycles/cycles.module';
import { FacilitiesService } from './facilities.service';
import { OrganizationController } from './organization.controller';
import { RoomsController, ZonesController } from './rooms.controller';
import { SitesController } from './sites.controller';

@Module({
  imports: [AuthModule, CyclesModule],
  controllers: [SitesController, RoomsController, ZonesController, OrganizationController],
  providers: [FacilitiesService],
})
export class FacilitiesModule {}
