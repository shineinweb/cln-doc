import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CyclesModule } from '../cycles/cycles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FacilitiesService } from './facilities.service';
import { RoomTasksService } from './room-tasks.service';
import { OrganizationController } from './organization.controller';
import { RoomsController, ZonesController } from './rooms.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SitesController } from './sites.controller';

@Module({
  imports: [AuthModule, CyclesModule, NotificationsModule],
  controllers: [SitesController, RoomsController, ZonesController, OrganizationController, SettingsController],
  providers: [FacilitiesService, SettingsService, RoomTasksService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
