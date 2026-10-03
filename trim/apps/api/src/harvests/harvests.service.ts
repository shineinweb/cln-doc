import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateHarvest,
  CreatePackage,
  HarvestDetail,
  HarvestSummary,
  HarvestWasteView,
  PackageDetail,
  RecordWaste,
  RecordWeight,
  SessionUser,
  StartDrying,
  WeightLedger,
} from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';

const harvestInclude = {
  license: { include: { sites: { include: { site: true } } } },
  site: true,
  cycle: true,
  room: true,
  plants: { orderBy: { tag: 'asc' as const } },
  steps: { include: { actor: true, room: true }, orderBy: { occurredAt: 'asc' as const } },
  wastes: { include: { actor: true }, orderBy: { recordedAt: 'asc' as const } },
  packages: { include: { plants: true, submissions: { orderBy: { requestedAt: 'desc' as const }, take: 1 } }, orderBy: { recordedAt: 'asc' as const } },
} as const;

type HarvestRecord = {
  id: string;
  name: string;
  licenseId: string;
  license: {
    licenseNumber: string;
    organizationId: string;
    sites: Array<{ siteId: string; site: { name: string } }>;
  };
  site: { name: string } | null;
  cycle: { name: string } | null;
  room: { name: string } | null;
  plants: Array<{ id: string; plantId: string; tag: string }>;
  steps: Array<{
    id: string;
    kind: string;
    occurredAt: Date;
    weightGrams: number | null;
    note: string | null;
    actor: { name: string };
    room: { name: string } | null;
  }>;
  wastes: Array<{
    id: string;
    harvestId: string;
    weightGrams: number;
    note: string | null;
    recordedAt: Date;
    actor: { name: string };
  }>;
  packages: Array<{
    id: string;
    label: string;
    weightGrams: number;
    plants: Array<{ tag: string }>;
  }>;
};

@Injectable()
export class HarvestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser): Promise<HarvestSummary[]> {
    const rows = await this.prisma.harvest.findMany({
      where: this.visibleWhere(user),
      include: harvestInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      licenseNumber: row.license.licenseNumber,
      siteName: row.site?.name ?? row.license.sites[0]?.site.name ?? null,
      plantCount: row.plants.length,
      ledger: this.ledger(row),
    }));
  }

  async getOne(user: SessionUser, harvestId: string): Promise<HarvestDetail> {
    return this.toDetail(await this.loadAuthorized(user, harvestId));
  }

  async listWaste(user: SessionUser, harvestId: string): Promise<HarvestWasteView[]> {
    const harvest = await this.loadAuthorized(user, harvestId);
    return harvest.wastes.map((waste) => this.toWaste(waste));
  }

  async getPackage(user: SessionUser, packageId: string): Promise<PackageDetail> {
    const row = await this.prisma.harvestPackage.findUnique({
      where: { id: packageId },
      include: {
        actor: true,
        plants: { include: { harvestPlant: true }, orderBy: { tag: 'asc' } },
        submissions: { orderBy: { requestedAt: 'desc' }, take: 1 },
        harvest: { include: harvestInclude },
      },
    });
    if (!row || row.harvest.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Package not found');
    }
    this.assertCovered(user, row.harvest.license.sites.map((link) => link.siteId), 'You do not have access to this package');
    const submission = row.submissions[0] ?? null;
    return {
      id: row.id,
      harvestId: row.harvestId,
      harvestName: row.harvest.name,
      licenseId: row.licenseId,
      licenseNumber: row.harvest.license.licenseNumber,
      label: row.label,
      weightGrams: row.weightGrams,
      actorName: row.actor.name,
      recordedAt: row.recordedAt.toISOString(),
      sourceTags: row.plants.map((plant) => ({
        plantId: plant.harvestPlant.plantId,
        tag: plant.tag,
      })),
      ledger: this.ledger(row.harvest),
      submission: submission ? { id: submission.id, status: submission.status } : null,
    };
  }

  async create(user: SessionUser, input: CreateHarvest): Promise<HarvestDetail> {
    const cycle = await this.prisma.cropCycle.findUnique({
      where: { id: input.cycleId },
      include: {
        room: { include: { site: true } },
        plants: true,
      },
    });
    if (!cycle || cycle.room.site.organizationId !== user.organizationId) {
      throw new NotFoundException('Crop cycle not found');
    }
    this.assertCovered(user, [cycle.room.siteId], 'You do not have access to this harvest');
    if (cycle.plants.length === 0) {
      throw new BadRequestException('This crop has no plants to harvest.');
    }
    const licenseIds = [...new Set(cycle.plants.map((plant) => plant.licenseId))];
    if (licenseIds.length !== 1) {
      throw new BadRequestException('These plants are not on one license.');
    }
    const licenseId = licenseIds[0];
    if (!licenseId) {
      throw new BadRequestException('These plants are not on one license.');
    }
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: { sites: true },
    });
    if (!license || license.organizationId !== user.organizationId) {
      throw new NotFoundException('Crop cycle not found');
    }
    if (!license.sites.some((link) => link.siteId === cycle.room.siteId)) {
      throw new BadRequestException('This crop is not on the license that covers the room.');
    }
    this.assertCovered(user, license.sites.map((link) => link.siteId), 'You do not have access to this harvest');
    const already = await this.prisma.harvestPlant.findFirst({
      where: { plantId: { in: cycle.plants.map((plant) => plant.id) } },
    });
    if (already) {
      throw new BadRequestException('A plant on this crop is already on a harvest.');
    }
    const occurredAt = new Date();
    const harvest = await this.prisma.$transaction(async (tx) => {
      const created = await tx.harvest.create({
        data: {
          licenseId: license.id,
          siteId: cycle.room.siteId,
          cycleId: cycle.id,
          roomId: cycle.roomId,
          name: `${cycle.name} harvest`,
        },
      });
      await tx.harvestPlant.createMany({
        data: cycle.plants.map((plant) => ({
          harvestId: created.id,
          plantId: plant.id,
          tag: plant.tag,
        })),
      });
      await tx.harvestStep.create({
        data: {
          harvestId: created.id,
          kind: 'harvested',
          actorUserId: user.id,
          occurredAt,
          note: `${cycle.plants.length} plants recorded with their tags.`,
        },
      });
      await tx.plantEvent.createMany({
        data: cycle.plants.map((plant) => ({
          plantId: plant.id,
          licenseId: plant.licenseId,
          eventType: 'harvested',
          actorUserId: user.id,
          occurredAt,
          fromRoomId: plant.roomId,
          fromStage: plant.stage,
          toStage: 'harvested',
          note: `Harvested on ${created.name}.`,
        })),
      });
      await tx.plant.updateMany({
        where: { id: { in: cycle.plants.map((plant) => plant.id) } },
        data: { status: 'harvested', stage: 'harvested', cycleId: null },
      });
      return created;
    });
    return this.getOne(user, harvest.id);
  }

  async recordWetWeight(user: SessionUser, harvestId: string, input: RecordWeight): Promise<HarvestDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'harvested', 'Harvest the plants before recording a wet weight.');
    this.rejectDuplicate(harvest, 'wet_weight', 'Wet weight is already recorded.');
    await this.addStep(harvest.id, user.id, 'wet_weight', input.grams);
    return this.getOne(user, harvest.id);
  }

  async startDrying(user: SessionUser, harvestId: string, input: StartDrying): Promise<HarvestDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'wet_weight', 'Record a wet weight before drying.');
    this.rejectDuplicate(harvest, 'drying', 'Drying has already started.');
    let roomId: string | null = null;
    if (input.roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: input.roomId }, include: { site: true } });
      const siteIds = harvest.license.sites.map((link) => link.siteId);
      if (!room || room.site.organizationId !== user.organizationId || !siteIds.includes(room.siteId)) {
        throw new BadRequestException('Choose a drying room on this license.');
      }
      roomId = room.id;
    }
    await this.addStep(harvest.id, user.id, 'drying', null, roomId, 'Drying started.');
    return this.getOne(user, harvest.id);
  }

  async recordDryWeight(user: SessionUser, harvestId: string, input: RecordWeight): Promise<HarvestDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'drying', 'Start drying before recording a dry weight.');
    this.rejectDuplicate(harvest, 'dry_weight', 'Dry weight is already recorded.');
    await this.addStep(harvest.id, user.id, 'dry_weight', input.grams);
    return this.getOne(user, harvest.id);
  }

  async recordTrimming(user: SessionUser, harvestId: string): Promise<HarvestDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'dry_weight', 'Record a dry weight before trimming.');
    this.rejectDuplicate(harvest, 'trimming', 'Trimming is already recorded.');
    await this.addStep(harvest.id, user.id, 'trimming', null, null, 'Trimming recorded.');
    return this.getOne(user, harvest.id);
  }

  async recordWaste(user: SessionUser, harvestId: string, input: RecordWaste): Promise<HarvestDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'trimming', 'Trim the harvest before recording waste.');
    this.assertFits(harvest, input.grams);
    await this.prisma.harvestWaste.create({
      data: {
        harvestId: harvest.id,
        weightGrams: input.grams,
        note: input.note ?? null,
        actorUserId: user.id,
        recordedAt: new Date(),
      },
    });
    return this.getOne(user, harvest.id);
  }

  async createPackage(user: SessionUser, harvestId: string, input: CreatePackage): Promise<PackageDetail> {
    const harvest = await this.loadAuthorized(user, harvestId);
    this.requireStep(harvest, 'trimming', 'Trim the harvest before creating a package.');
    this.assertFits(harvest, input.grams);
    const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length === 0) {
      throw new BadRequestException('A package needs at least one plant tag.');
    }
    const byTag = new Map(harvest.plants.map((plant) => [plant.tag, plant]));
    const missing = tags.filter((tag) => !byTag.has(tag));
    if (missing.length > 0) {
      throw new BadRequestException('That plant is not on this harvest.');
    }
    const duplicate = await this.prisma.harvestPackage.findFirst({
      where: { licenseId: harvest.licenseId, label: input.label.trim() },
    });
    if (duplicate) {
      throw new BadRequestException('That package label is already used on this license.');
    }
    const created = await this.prisma.harvestPackage.create({
      data: {
        harvestId: harvest.id,
        licenseId: harvest.licenseId,
        label: input.label.trim(),
        weightGrams: input.grams,
        actorUserId: user.id,
        recordedAt: new Date(),
        plants: {
          create: tags.map((tag) => {
            const plant = byTag.get(tag);
            if (!plant) {
              throw new BadRequestException('That plant is not on this harvest.');
            }
            return { harvestPlantId: plant.id, tag };
          }),
        },
      },
    });
    return this.getPackage(user, created.id);
  }

  private visibleWhere(user: SessionUser) {
    return {
      license: {
        organizationId: user.organizationId,
        ...(user.isOrgAdmin ? {} : { sites: { some: { siteId: { in: user.siteIds } } } }),
      },
    };
  }

  private async loadAuthorized(user: SessionUser, harvestId: string): Promise<HarvestRecord> {
    const row = await this.prisma.harvest.findUnique({
      where: { id: harvestId },
      include: harvestInclude,
    });
    if (!row || row.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Harvest not found');
    }
    this.assertCovered(user, row.license.sites.map((link) => link.siteId), 'You do not have access to this harvest');
    return row;
  }

  private assertCovered(user: SessionUser, siteIds: string[], denied: string): void {
    if (user.isOrgAdmin) {
      return;
    }
    if (!siteIds.some((siteId) => user.siteIds.includes(siteId))) {
      throw new ForbiddenException(denied);
    }
  }

  private requireStep(harvest: HarvestRecord, kind: string, message: string): void {
    if (!harvest.steps.some((step) => step.kind === kind)) {
      throw new BadRequestException(message);
    }
  }

  private rejectDuplicate(harvest: HarvestRecord, kind: string, message: string): void {
    if (harvest.steps.some((step) => step.kind === kind)) {
      throw new BadRequestException(message);
    }
  }

  private assertFits(harvest: HarvestRecord, grams: number): void {
    const figures = this.ledger(harvest);
    if (figures.dryWeightGrams === null || figures.unaccountedGrams === null) {
      throw new BadRequestException('Record a dry weight before waste or a package.');
    }
    if (grams > figures.unaccountedGrams) {
      throw new BadRequestException(
        `That weight is more than the dry weight still unaccounted. Dry ${figures.dryWeightGrams} g, packages ${figures.packageWeightGrams} g, waste ${figures.wasteWeightGrams} g, unaccounted ${figures.unaccountedGrams} g.`,
      );
    }
  }

  private ledger(harvest: Pick<HarvestRecord, 'steps' | 'wastes' | 'packages'>): WeightLedger {
    const wet = harvest.steps.find((step) => step.kind === 'wet_weight')?.weightGrams ?? null;
    const dry = harvest.steps.find((step) => step.kind === 'dry_weight')?.weightGrams ?? null;
    const packageWeightGrams = harvest.packages.reduce((sum, row) => sum + row.weightGrams, 0);
    const wasteWeightGrams = harvest.wastes.reduce((sum, row) => sum + row.weightGrams, 0);
    return {
      wetWeightGrams: wet,
      dryWeightGrams: dry,
      packageWeightGrams,
      wasteWeightGrams,
      unaccountedGrams: dry === null ? null : dry - packageWeightGrams - wasteWeightGrams,
    };
  }

  private async addStep(
    harvestId: string,
    actorUserId: string,
    kind: string,
    weightGrams: number | null,
    roomId?: string | null,
    note?: string,
  ): Promise<void> {
    await this.prisma.harvestStep.create({
      data: {
        harvestId,
        kind,
        actorUserId,
        occurredAt: new Date(),
        weightGrams,
        roomId: roomId ?? null,
        note: note ?? null,
      },
    });
  }

  private toWaste(waste: HarvestRecord['wastes'][number]): HarvestWasteView {
    return {
      id: waste.id,
      harvestId: waste.harvestId,
      weightGrams: waste.weightGrams,
      note: waste.note,
      actorName: waste.actor.name,
      recordedAt: waste.recordedAt.toISOString(),
    };
  }

  private toDetail(harvest: HarvestRecord): HarvestDetail {
    return {
      id: harvest.id,
      name: harvest.name,
      licenseId: harvest.licenseId,
      licenseNumber: harvest.license.licenseNumber,
      siteName: harvest.site?.name ?? null,
      cycleName: harvest.cycle?.name ?? null,
      roomName: harvest.room?.name ?? null,
      plantCount: harvest.plants.length,
      plants: harvest.plants.map((plant) => ({ plantId: plant.plantId, tag: plant.tag })),
      steps: harvest.steps.map((step) => ({
        id: step.id,
        kind: step.kind,
        actorName: step.actor.name,
        occurredAt: step.occurredAt.toISOString(),
        weightGrams: step.weightGrams,
        roomName: step.room?.name ?? null,
        note: step.note,
      })),
      wastes: harvest.wastes.map((waste) => this.toWaste(waste)),
      packages: harvest.packages.map((item) => ({
        id: item.id,
        label: item.label,
        weightGrams: item.weightGrams,
        sourceTagCount: item.plants.length,
      })),
      ledger: this.ledger(harvest),
    };
  }
}
