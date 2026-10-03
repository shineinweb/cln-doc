import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  createRoomSchema,
  recordRemovedSchema,
  roomPageSchema,
  type CreateRoom,
  type RecordRemoved,
  type Room,
  type SessionUser,
  type Site,
} from '@trim/contracts';
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

  @Get(':siteId/room-pages')
  async pageRooms(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '5',
  ) {
    return roomPageSchema.parse(await this.facilities.pageRooms(user, siteId, page, pageSize));
  }

  @Post(':siteId/rooms')
  createRoom(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(createRoomSchema)) body: CreateRoom,
  ): Promise<Room> {
    return this.facilities.createRoom(user, siteId, body);
  }

  @Patch(':siteId/rooms/:roomId')
  updateRoom(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(createRoomSchema)) body: CreateRoom,
  ): Promise<Room> {
    return this.facilities.updateRoom(user, siteId, roomId, body);
  }

  @Delete(':siteId/rooms/:roomId')
  async deleteRoom(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Param('roomId') roomId: string,
  ): Promise<RecordRemoved> {
    return recordRemovedSchema.parse(await this.facilities.deleteRoom(user, siteId, roomId));
  }

  @Get(':siteId')
  get(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<Site> {
    return this.facilities.getSite(user, siteId);
  }
}
