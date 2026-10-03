import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { Room, SessionUser, Site } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FacilitiesService } from './facilities.service';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<Site[]> {
    return this.facilities.listSites(user);
  }

  @Get(':siteId/rooms')
  listRooms(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<Room[]> {
    return this.facilities.listRooms(user, siteId);
  }

  @Get(':siteId')
  get(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<Site> {
    return this.facilities.getSite(user, siteId);
  }
}
