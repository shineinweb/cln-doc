import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  managedTaskInputSchema,
  managedTaskSchema,
  recordRemovedSchema,
  zoneInputSchema,
  type ManagedTaskInput,
  type RecordRemoved,
  type RoomDetail,
  type SessionUser,
  type Zone,
  type ZoneInput,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FacilitiesService } from './facilities.service';
import { RoomTasksService } from './room-tasks.service';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(
    private readonly facilities: FacilitiesService,
    private readonly roomTasks: RoomTasksService,
  ) {}

  @Get(':roomId')
  get(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string): Promise<RoomDetail> {
    return this.facilities.getRoom(user, roomId);
  }

  @Post(':roomId/tasks')
  async createTask(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Body(new ZodValidationPipe(managedTaskInputSchema)) body: ManagedTaskInput,
  ) {
    return managedTaskSchema.parse(await this.roomTasks.create(user, roomId, body));
  }

  @Patch(':roomId/tasks/:taskId')
  async updateTask(
    @CurrentUser() user: SessionUser,
    @Param('roomId') roomId: string,
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(managedTaskInputSchema)) body: ManagedTaskInput,
  ) {
    return managedTaskSchema.parse(await this.roomTasks.update(user, roomId, taskId, body));
  }

  @Delete(':roomId/tasks/:taskId')
  async deleteTask(@CurrentUser() user: SessionUser, @Param('roomId') roomId: string, @Param('taskId') taskId: string) {
    return recordRemovedSchema.parse(await this.roomTasks.remove(user, roomId, taskId));
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
