import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChangePlantStage,
  ComplianceOverview,
  LicenseInventory,
  MetrcImportSummary,
  MetrcInventoryPayload,
  MovePlant,
  PlantDetail,
  PlantObservation,
  SessionUser,
} from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { compareTags } from './reconcile';

const PLANT_LIST_LIMIT = 12;

type LicenseAccess = {
  id: string;
  organizationId: string;
  licenseNumber: string;
  licenseType: string;
  sites: Array<{ siteId: string; site: { name: string } }>;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async compliance(user: SessionUser): Promise<ComplianceOverview> {
    const licenses = await this.visibleLicenses(user);
    return { licenses: await Promise.all(licenses.map((license) => this.toComplianceLicense(license))) };
  }

  async licenseInventory(user: SessionUser, licenseId: string): Promise<LicenseInventory> {
    const license = await this.assertLicenseAccess(user, licenseId);
    const [plantCount, plants, latestImport] = await Promise.all([
      this.prisma.plant.count({ where: { licenseId: license.id } }),
      this.prisma.plant.findMany({
        where: { licenseId: license.id },
        include: { strain: true, room: true, cycle: true },
        orderBy: { tag: 'asc' },
        take: PLANT_LIST_LIMIT,
      }),
      this.latestImport(license.id),
    ]);
    return {
      id: license.id,
      licenseNumber: license.licenseNumber,
      licenseType: license.licenseType,
      siteNames: license.sites.map((link) => link.site.name),
      plantCount,
      listedCount: plants.length,
      plants: plants.map((plant) => ({
        id: plant.id,
        tag: plant.tag,
        strainName: plant.strain.name,
        stage: plant.stage,
        status: plant.status,
        roomName: plant.room?.name ?? null,
        cycleName: plant.cycle?.name ?? null,
      })),
      latestImport,
    };
  }

  async plantDetail(user: SessionUser, plantId: string): Promise<PlantDetail> {
    const plant = await this.loadPlant(user, plantId);
    return this.toPlantDetail(plant);
  }

  async move(user: SessionUser, plantId: string, input: MovePlant): Promise<PlantDetail> {
    const plant = await this.loadPlant(user, plantId);
    const room = await this.prisma.room.findUnique({ where: { id: input.roomId }, include: { site: true } });
    const allowedSiteIds = new Set(plant.license.sites.map((link) => link.siteId));
    if (!room || room.site.organizationId !== user.organizationId || !allowedSiteIds.has(room.siteId)) {
      throw new BadRequestException('That room is not on a facility covered by this license');
    }
    await this.prisma.$transaction([
      this.prisma.plant.update({ where: { id: plant.id }, data: { roomId: room.id } }),
      this.prisma.plantEvent.create({
        data: {
          plantId: plant.id,
          licenseId: plant.licenseId,
          eventType: 'moved',
          actorUserId: user.id,
          occurredAt: new Date(),
          fromRoomId: plant.roomId,
          toRoomId: room.id,
        },
      }),
    ]);
    return this.plantDetail(user, plant.id);
  }

  async changeStage(user: SessionUser, plantId: string, input: ChangePlantStage): Promise<PlantDetail> {
    const plant = await this.loadPlant(user, plantId);
    await this.prisma.$transaction([
      this.prisma.plant.update({ where: { id: plant.id }, data: { stage: input.stage } }),
      this.prisma.plantEvent.create({
        data: {
          plantId: plant.id,
          licenseId: plant.licenseId,
          eventType: 'stage_changed',
          actorUserId: user.id,
          occurredAt: new Date(),
          fromStage: plant.stage,
          toStage: input.stage,
        },
      }),
    ]);
    return this.plantDetail(user, plant.id);
  }

  async observe(user: SessionUser, plantId: string, input: PlantObservation): Promise<PlantDetail> {
    const plant = await this.loadPlant(user, plantId);
    await this.prisma.plantEvent.create({
      data: {
        plantId: plant.id,
        licenseId: plant.licenseId,
        eventType: 'observed',
        actorUserId: user.id,
        occurredAt: new Date(),
        note: input.note,
      },
    });
    return this.plantDetail(user, plant.id);
  }

  /**
   * Compare a Metrc-shaped inventory file with local plants on one license.
   * This does not call Metrc and does not read metrc_connections or METRC_* env vars.
   */
  async importInventory(user: SessionUser, licenseId: string, payload: MetrcInventoryPayload): Promise<MetrcImportSummary> {
    const license = await this.assertLicenseAccess(user, licenseId);
    if (payload.LicenseNumber !== license.licenseNumber) {
      throw new BadRequestException('The file license number does not match this license');
    }
    const local = await this.prisma.plant.findMany({
      where: { licenseId: license.id },
      select: { tag: true },
      orderBy: { tag: 'asc' },
    });
    const comparison = compareTags(
      local.map((plant) => plant.tag),
      payload.Plants.map((plant) => plant.Label),
    );
    const discrepancies = [
      ...comparison.extraTags.map((tag) => ({ tag, kind: 'extra_tag' as const })),
      ...comparison.missingTags.map((tag) => ({ tag, kind: 'missing_tag' as const })),
    ];
    const created = await this.prisma.metrcInventoryImport.create({
      data: {
        licenseId: license.id,
        source: 'payload',
        status: 'reconciled',
        matchedCount: comparison.matched.length,
        discrepancyCount: discrepancies.length,
        importedAt: new Date(),
        discrepancies: {
          create: discrepancies.map((row) => ({ licenseId: license.id, tag: row.tag, kind: row.kind })),
        },
      },
      include: { discrepancies: { orderBy: { tag: 'asc' } } },
    });
    return this.toImport(created);
  }

  private async visibleLicenses(user: SessionUser): Promise<LicenseAccess[]> {
    return this.prisma.license.findMany({
      where: {
        organizationId: user.organizationId,
        ...(user.isOrgAdmin ? {} : { sites: { some: { siteId: { in: user.siteIds } } } }),
      },
      include: { sites: { include: { site: true } } },
      orderBy: { licenseNumber: 'asc' },
    });
  }

  private async assertLicenseAccess(user: SessionUser, licenseId: string): Promise<LicenseAccess> {
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: { sites: { include: { site: true } } },
    });
    if (!license || license.organizationId !== user.organizationId) {
      throw new NotFoundException('License not found');
    }
    const covered = license.sites.some((link) => user.siteIds.includes(link.siteId));
    if (!user.isOrgAdmin && !covered) {
      throw new ForbiddenException('You do not have access to this license');
    }
    return license;
  }

  private async loadPlant(user: SessionUser, plantId: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      include: {
        strain: true,
        batch: true,
        room: true,
        cycle: true,
        license: { include: { sites: { include: { site: true } } } },
        events: { include: { actor: true }, orderBy: { occurredAt: 'asc' } },
      },
    });
    if (!plant || plant.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Plant not found');
    }
    const covered = plant.license.sites.some((link) => user.siteIds.includes(link.siteId));
    if (!user.isOrgAdmin && !covered) {
      throw new ForbiddenException('You do not have access to this plant');
    }
    return plant;
  }

  private async toPlantDetail(plant: Awaited<ReturnType<InventoryService['loadPlant']>>): Promise<PlantDetail> {
    const roomIds = [
      ...new Set(plant.events.flatMap((event) => [event.fromRoomId, event.toRoomId].filter((id): id is string => Boolean(id)))),
    ];
    const rooms = roomIds.length
      ? await this.prisma.room.findMany({ where: { id: { in: roomIds } }, select: { id: true, name: true } })
      : [];
    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    return {
      id: plant.id,
      tag: plant.tag,
      strainName: plant.strain.name,
      batchName: plant.batch.name,
      stage: plant.stage,
      status: plant.status,
      licenseId: plant.licenseId,
      licenseNumber: plant.license.licenseNumber,
      siteNames: plant.license.sites.map((link) => link.site.name),
      roomId: plant.roomId,
      roomName: plant.room?.name ?? null,
      cycleId: plant.cycleId,
      cycleName: plant.cycle?.name ?? null,
      events: plant.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.occurredAt.toISOString(),
        actorName: event.actor.name,
        fromRoomName: event.fromRoomId ? (roomNames.get(event.fromRoomId) ?? null) : null,
        toRoomName: event.toRoomId ? (roomNames.get(event.toRoomId) ?? null) : null,
        fromStage: event.fromStage,
        toStage: event.toStage,
        note: event.note,
      })),
    };
  }

  private async toComplianceLicense(license: LicenseAccess): Promise<ComplianceOverview['licenses'][number]> {
    const [plantCount, latestImport] = await Promise.all([
      this.prisma.plant.count({ where: { licenseId: license.id } }),
      this.latestImport(license.id),
    ]);
    return {
      id: license.id,
      licenseNumber: license.licenseNumber,
      licenseType: license.licenseType,
      siteNames: license.sites.map((link) => link.site.name),
      plantCount,
      latestImport,
    };
  }

  private async latestImport(licenseId: string): Promise<MetrcImportSummary | null> {
    const row = await this.prisma.metrcInventoryImport.findFirst({
      where: { licenseId },
      orderBy: { importedAt: 'desc' },
      include: { discrepancies: { orderBy: { tag: 'asc' } } },
    });
    return row ? this.toImport(row) : null;
  }

  private toImport(row: {
    id: string;
    source: string;
    status: string;
    matchedCount: number;
    discrepancyCount: number;
    importedAt: Date;
    discrepancies: Array<{ id: string; tag: string; kind: string }>;
  }): MetrcImportSummary {
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      matchedCount: row.matchedCount,
      discrepancyCount: row.discrepancyCount,
      importedAt: row.importedAt.toISOString(),
      discrepancies: row.discrepancies.map((item) => ({
        id: item.id,
        tag: item.tag,
        kind: item.kind === 'missing_tag' ? 'missing_tag' : 'extra_tag',
      })),
    };
  }
}
