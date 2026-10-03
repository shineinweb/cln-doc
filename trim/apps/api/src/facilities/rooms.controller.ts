import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { RoomDetail, SessionUser } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FacilitiesService } from './facilities.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get(':roomId')
  get(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string): Promise<RoomDetail> {
    return this.facilities.getRoom(user, roomId);
  }
}
