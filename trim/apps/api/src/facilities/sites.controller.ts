import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { createRoomSchema, type CreateRoom, type Room, type SessionUser, type Site } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
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

  @Post(':siteId/rooms')
  createRoom(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(createRoomSchema)) body: CreateRoom,
  ): Promise<Room> {
    return this.facilities.createRoom(user, siteId, body);
  }

  @Get(':siteId')
  get(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<Site> {
    return this.facilities.getSite(user, siteId);
  }
}
