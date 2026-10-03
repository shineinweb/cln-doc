import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ControllerReading, ControllerSample, SessionUser } from '@trim/contracts';
import { parseRecordedAt } from '../environment/wall-time';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ControllerAdapterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser, roomId: string): Promise<ControllerReading[]> {
    await this.roomInScope(user, roomId);
    const rows = await this.prisma.controllerReading.findMany({
      where: { roomId },
      orderBy: { recordedAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async postSample(user: SessionUser, roomId: string, body: ControllerSample): Promise<ControllerReading> {
    const room = await this.roomInScope(user, roomId);
    const recordedAt = this.timestamp(body.recordedAt, room.site.timezone);
    const row = await this.prisma.controllerReading.create({
      data: {
        roomId,
        deviceId: body.deviceId,
        metric: body.metric,
        value: body.value,
        unit: body.unit,
        recordedAt,
        quality: body.quality,
        isSample: true,
      },
    });
    return this.toView(row);
  }

  private async roomInScope(user: SessionUser, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { site: true },
    });
    if (!room || room.site.organizationId !== user.organizationId) {
      throw new NotFoundException('Room not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(room.siteId)) {
      throw new ForbiddenException('You do not have access to this controller.');
    }
    return room;
  }

  private timestamp(input: string, timeZone: string): Date {
    try {
      return parseRecordedAt(input, timeZone);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That timestamp is not valid.';
      throw new BadRequestException(message);
    }
  }

  private toView(row: {
    id: string;
    roomId: string;
    deviceId: string;
    metric: string;
    value: { toString(): string };
    unit: string;
    recordedAt: Date;
    quality: string;
  }): ControllerReading {
    return {
      id: row.id,
      roomId: row.roomId,
      deviceId: row.deviceId,
      metric: row.metric,
      value: Number(row.value),
      unit: row.unit,
      recordedAt: row.recordedAt.toISOString(),
      quality: row.quality,
      isSample: true,
    };
  }
}
