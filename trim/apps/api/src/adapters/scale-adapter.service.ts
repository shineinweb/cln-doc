import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { ScaleSampleInput, ScaleSampleView, SessionUser } from '@trim/contracts';
import { parseRecordedAt } from '../environment/wall-time';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScaleAdapterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser, harvestId: string): Promise<ScaleSampleView[]> {
    await this.harvestInScope(user, harvestId);
    const rows = await this.prisma.scaleSample.findMany({
      where: { harvestId },
      orderBy: { recordedAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async postSample(user: SessionUser, harvestId: string, body: ScaleSampleInput): Promise<ScaleSampleView> {
    const harvest = await this.harvestInScope(user, harvestId);
    const recordedAt = this.timestamp(body.recordedAt, harvest.timeZone);
    const row = await this.prisma.scaleSample.create({
      data: {
        harvestId,
        deviceId: body.deviceId,
        weightGrams: body.weightGrams,
        unit: body.unit,
        recordedAt,
        quality: body.quality,
        isSample: true,
      },
    });
    return this.toView(row);
  }

  private async harvestInScope(user: SessionUser, harvestId: string) {
    const harvest = await this.prisma.harvest.findUnique({
      where: { id: harvestId },
      include: {
        site: true,
        license: { include: { sites: { include: { site: true } } } },
      },
    });
    if (!harvest || harvest.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Harvest not found');
    }
    const siteIds = harvest.license.sites.map((link) => link.siteId);
    if (!user.isOrgAdmin && !siteIds.some((siteId) => user.siteIds.includes(siteId))) {
      throw new ForbiddenException('You do not have access to this scale.');
    }
    const timeZone = harvest.site?.timezone ?? harvest.license.sites[0]?.site.timezone ?? 'America/Los_Angeles';
    return { timeZone };
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
    harvestId: string;
    deviceId: string;
    weightGrams: number;
    unit: string;
    recordedAt: Date;
    quality: string;
  }): ScaleSampleView {
    return {
      id: row.id,
      harvestId: row.harvestId,
      deviceId: row.deviceId,
      weightGrams: row.weightGrams,
      unit: row.unit,
      recordedAt: row.recordedAt.toISOString(),
      quality: row.quality,
      isSample: true,
    };
  }
}
