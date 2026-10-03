import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser, TagSampleInput, TagSampleView } from '@trim/contracts';
import { parseRecordedAt } from '../environment/wall-time';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagAdapterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser, harvestId: string): Promise<TagSampleView[]> {
    await this.harvestInScope(user, harvestId);
    const rows = await this.prisma.harvestTagSample.findMany({
      where: { harvestId },
      orderBy: { recordedAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async postSample(user: SessionUser, harvestId: string, body: TagSampleInput): Promise<TagSampleView> {
    const harvest = await this.harvestInScope(user, harvestId);
    const before = await this.counts(harvestId);
    const row = await this.prisma.harvestTagSample.create({
      data: {
        harvestId,
        deviceId: body.deviceId,
        tag: body.tag,
        recordedAt: this.timestamp(body.recordedAt, harvest.timeZone),
        quality: body.quality,
        isSample: true,
      },
    });
    const after = await this.counts(harvestId);
    if (
      before.plants !== after.plants ||
      before.steps !== after.steps ||
      before.packages !== after.packages ||
      before.wastes !== after.wastes
    ) {
      throw new BadRequestException('A sample tag must not change the harvest.');
    }
    return this.toView(row);
  }

  private async counts(harvestId: string) {
    const [plants, steps, packages, wastes] = await Promise.all([
      this.prisma.harvestPlant.count({ where: { harvestId } }),
      this.prisma.harvestStep.count({ where: { harvestId } }),
      this.prisma.harvestPackage.count({ where: { harvestId } }),
      this.prisma.harvestWaste.count({ where: { harvestId } }),
    ]);
    return { plants, steps, packages, wastes };
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
      throw new ForbiddenException('You do not have access to this harvest.');
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
    tag: string;
    recordedAt: Date;
    quality: string;
  }): TagSampleView {
    return {
      id: row.id,
      harvestId: row.harvestId,
      deviceId: row.deviceId,
      tag: row.tag,
      recordedAt: row.recordedAt.toISOString(),
      quality: row.quality,
      isSample: true,
    };
  }
}
