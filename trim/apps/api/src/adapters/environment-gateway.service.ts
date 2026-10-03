import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { EnvironmentalReading, GatewayReading, SensorGateway, SessionUser } from '@trim/contracts';
import { EnvironmentService } from '../environment/environment.service';
import { parseRecordedAt } from '../environment/wall-time';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EnvironmentGatewayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly environment: EnvironmentService,
  ) {}

  async getGateway(user: SessionUser, gatewayId: string): Promise<SensorGateway> {
    const gateway = await this.loadGateway(user, gatewayId);
    return { id: gateway.id, siteId: gateway.siteId, name: gateway.name };
  }

  async gatewayForSite(user: SessionUser, siteId: string): Promise<SensorGateway> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site || site.organizationId !== user.organizationId) {
      throw new NotFoundException('Gateway not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(site.id)) {
      throw new ForbiddenException('You do not have access to this gateway.');
    }
    const gateway = await this.prisma.sensorGateway.findFirst({
      where: { siteId },
      orderBy: { name: 'asc' },
    });
    if (!gateway) {
      throw new NotFoundException('Gateway not found');
    }
    return { id: gateway.id, siteId: gateway.siteId, name: gateway.name };
  }

  async postReading(user: SessionUser, gatewayId: string, body: GatewayReading): Promise<EnvironmentalReading> {
    const gateway = await this.loadGateway(user, gatewayId);
    const room = await this.prisma.room.findUnique({
      where: { id: body.roomId },
      include: { site: true },
    });
    if (!room || room.site.organizationId !== user.organizationId) {
      throw new NotFoundException('Room not found');
    }
    if (room.siteId !== gateway.siteId) {
      throw new ForbiddenException('This gateway cannot write that room.');
    }
    const recordedAt = this.timestamp(body.recordedAt, room.site.timezone);
    const reading = await this.prisma.environmentalReading.create({
      data: {
        roomId: room.id,
        deviceId: body.deviceId,
        metric: body.metric,
        value: body.value,
        unit: body.unit,
        recordedAt,
        quality: body.quality,
        isSample: false,
      },
    });
    await this.environment.evaluate(room.id);
    return {
      id: reading.id,
      recordedAt: reading.recordedAt.toISOString(),
      metric: reading.metric,
      value: Number(reading.value),
      unit: reading.unit,
      deviceId: reading.deviceId,
      quality: reading.quality,
      isSample: false,
    };
  }

  private async loadGateway(user: SessionUser, gatewayId: string) {
    const gateway = await this.prisma.sensorGateway.findUnique({
      where: { id: gatewayId },
      include: { site: true },
    });
    if (!gateway || gateway.site.organizationId !== user.organizationId) {
      throw new NotFoundException('Gateway not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(gateway.siteId)) {
      throw new ForbiddenException('You do not have access to this gateway.');
    }
    return gateway;
  }

  private timestamp(input: string, timeZone: string): Date {
    try {
      return parseRecordedAt(input, timeZone);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That timestamp is not valid.';
      throw new BadRequestException(message);
    }
  }
}
