import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { recordRemovedSchema, zoneInputSchema, type RecordRemoved, type RoomDetail, type SessionUser, type Zone, type ZoneInput } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FacilitiesService } from './facilities.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get(':roomId')
  get(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string): Promise<RoomDetail> {
    return this.facilities.getRoom(user, roomId);
  }

  @Post(':roomId/zones')
  createZone(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(zoneInputSchema)) body: ZoneInput,
  ): Promise<Zone> {
    return this.facilities.createZone(user, roomId, body);
  }
}

@Controller('zones')
@UseGuards(JwtAuthGuard)
export class ZonesController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Patch(':zoneId')
  update(
    @CurrentUser() user: SessionUser,
    @Param('zoneId') zoneId: string,
    @Body(new ZodValidationPipe(zoneInputSchema)) body: ZoneInput,
  ): Promise<Zone> {
    return this.facilities.updateZone(user, zoneId, body);
  }

  @Delete(':zoneId')
  async remove(@CurrentUser() user: SessionUser, @Param('zoneId') zoneId: string): Promise<RecordRemoved> {
    return recordRemovedSchema.parse(await this.facilities.deleteZone(user, zoneId));
  }
}
