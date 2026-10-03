import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AlertRuleEdit,
  BatchInput,
  CycleEdit,
  HarvestEdit,
  PackageEdit,
  PlantCreate,
  PlantEdit,
  ReadingEdit,
  RecordRemoved,
  SessionUser,
  SopEdit,
  SubmissionEdit,
  TaskEdit,
  TemplateEdit,
  WeightEdit,
} from '@trim/contracts';
import { addCalendarDays, calendarDaysBetween, dateKeyFromDbDate, dbDateFromKey } from '../cycles/cycle-day';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';

const removed = (id: string, voided: boolean): RecordRemoved => ({ id, removed: true, voided });

@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async editCycle(user: SessionUser, cycleId: string, input: CycleEdit): Promise<RecordRemoved> {
    const cycle = await this.cycle(user, cycleId);
    if (input.expectedHarvestDate < input.startDate) {
      throw new BadRequestException('Expected harvest must be on or after the start date.');
    }
    const currentStart = dateKeyFromDbDate(cycle.startDate);
    const version = cycle.workflowVersionId
      ? await this.prisma.workflowTemplateVersion.findUnique({ where: { id: cycle.workflowVersionId } })
      : null;
    const anchored = !version || version.startingEvent === 'cycle_start';
    await this.prisma.$transaction(async (tx) => {
      await tx.cropCycle.update({
        where: { id: cycle.id },
        data: {
          name: input.name,
          cultivar: input.cultivar,
          stage: input.stage,
          startDate: dbDateFromKey(input.startDate),
          expectedHarvestDate: dbDateFromKey(input.expectedHarvestDate),
        },
      });
      if (input.startDate === currentStart) {
        return;
      }
      const tasks = await tx.cycleTask.findMany({ where: { cycleId: cycle.id } });
      for (const task of tasks) {
        const dueOn = anchored
          ? addCalendarDays(input.startDate, task.offsetDays)
          : addCalendarDays(dateKeyFromDbDate(task.dueOn), calendarDaysBetween(currentStart, input.startDate));
        await tx.cycleTask.update({ where: { id: task.id }, data: { dueOn: dbDateFromKey(dueOn) } });
      }
    });
    return { id: cycle.id, removed: false, voided: false };
  }

  async deleteCycle(user: SessionUser, cycleId: string): Promise<RecordRemoved> {
    const cycle = await this.cycle(user, cycleId);
    await this.prisma.cropCycle.delete({ where: { id: cycle.id } });
    return removed(cycle.id, false);
  }

  async addTask(user: SessionUser, cycleId: string, input: TaskEdit): Promise<RecordRemoved> {
    const cycle = await this.cycle(user, cycleId);
    const task = await this.prisma.cycleTask.create({
      data: {
        cycleId: cycle.id,
        roomId: cycle.roomId,
        taskKey: `added-${Date.now()}`,
        title: input.title,
        instructions: 'Added on the crop cycle.',
        offsetDays: 0,
        dueOn: dbDateFromKey(input.dueOn),
        status: 'open',
        assigneeType: 'user',
        assigneeLabel: user.name,
        userId: user.id,
      },
    });
    return { id: task.id, removed: false, voided: false };
  }

  async editTask(user: SessionUser, taskId: string, input: TaskEdit): Promise<RecordRemoved> {
    const task = await this.task(user, taskId);
    await this.prisma.cycleTask.update({
      where: { id: task.id },
      data: { title: input.title, dueOn: dbDateFromKey(input.dueOn) },
    });
    return { id: task.id, removed: false, voided: false };
  }

  async deleteTask(user: SessionUser, taskId: string): Promise<RecordRemoved> {
    const task = await this.task(user, taskId);
    await this.prisma.cycleTask.delete({ where: { id: task.id } });
    return removed(task.id, false);
  }

  async editTemplate(user: SessionUser, templateId: string, input: TemplateEdit): Promise<RecordRemoved> {
    const template = await this.orgRow(user, templateId, 'workflowTemplate', 'Workflow template not found');
    try {
      await this.prisma.workflowTemplate.update({
        where: { id: template.id },
        data: {
          name: input.name,
          cultivar: blank(input.cultivar),
          medium: blank(input.medium),
        },
      });
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A workflow template with that name already exists.');
      }
      throw error;
    }
    return { id: template.id, removed: false, voided: false };
  }

  async deleteTemplate(user: SessionUser, templateId: string): Promise<RecordRemoved> {
    const template = await this.orgRow(user, templateId, 'workflowTemplate', 'Workflow template not found');
    const versions = await this.prisma.workflowTemplateVersion.findMany({ where: { templateId: template.id }, select: { id: true } });
    const used = await this.prisma.cropCycle.count({ where: { workflowVersionId: { in: versions.map((row) => row.id) } } });
    if (used > 0) {
      throw new BadRequestException('This template is still used by a crop cycle.');
    }
    await this.prisma.workflowTemplate.delete({ where: { id: template.id } });
    return removed(template.id, false);
  }

  async editSop(user: SessionUser, sopId: string, input: SopEdit): Promise<RecordRemoved> {
    const sop = await this.orgRow(user, sopId, 'sopRecord', 'Procedure not found');
    try {
      await this.prisma.sopRecord.update({ where: { id: sop.id }, data: { title: input.title, summary: input.summary } });
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A procedure with that title already exists.');
      }
      throw error;
    }
    return { id: sop.id, removed: false, voided: false };
  }

  async deleteSop(user: SessionUser, sopId: string): Promise<RecordRemoved> {
    const sop = await this.orgRow(user, sopId, 'sopRecord', 'Procedure not found');
    await this.prisma.workflowTaskTemplate.updateMany({ where: { sopRecordId: sop.id }, data: { sopRecordId: null } });
    await this.prisma.cycleTask.updateMany({ where: { sopRecordId: sop.id }, data: { sopRecordId: null } });
    await this.prisma.sopRecord.delete({ where: { id: sop.id } });
    return removed(sop.id, false);
  }

  async editReading(user: SessionUser, readingId: string, input: ReadingEdit): Promise<RecordRemoved> {
    const reading = await this.reading(user, readingId);
    await this.prisma.environmentalReading.update({
      where: { id: reading.id },
      data: { value: input.value, unit: input.unit, quality: input.quality },
    });
    return { id: reading.id, removed: false, voided: false };
  }

  async deleteReading(user: SessionUser, readingId: string): Promise<RecordRemoved> {
    const reading = await this.reading(user, readingId);
    await this.prisma.environmentalReading.delete({ where: { id: reading.id } });
    return removed(reading.id, false);
  }

  async editAlertRule(user: SessionUser, ruleId: string, input: AlertRuleEdit): Promise<RecordRemoved> {
    const rule = await this.rule(user, ruleId);
    await this.prisma.alertRule.update({
      where: { id: rule.id },
      data: { minValue: input.minValue, maxValue: input.maxValue, enabled: input.enabled },
    });
    return { id: rule.id, removed: false, voided: false };
  }

  async deleteAlertRule(user: SessionUser, ruleId: string): Promise<RecordRemoved> {
    const rule = await this.rule(user, ruleId);
    await this.prisma.alertRule.delete({ where: { id: rule.id } });
    return removed(rule.id, false);
  }

  async editHarvest(user: SessionUser, harvestId: string, input: HarvestEdit): Promise<RecordRemoved> {
    const harvest = await this.harvest(user, harvestId);
    await this.prisma.harvest.update({ where: { id: harvest.id }, data: { name: input.name } });
    return { id: harvest.id, removed: false, voided: false };
  }

  async voidHarvest(user: SessionUser, harvestId: string): Promise<RecordRemoved> {
    const harvest = await this.harvest(user, harvestId);
    await this.prisma.harvest.update({
      where: { id: harvest.id },
      data: { voidedAt: new Date(), voidedByName: user.name },
    });
    return removed(harvest.id, true);
  }

  async editStep(user: SessionUser, stepId: string, input: WeightEdit): Promise<RecordRemoved> {
    const step = await this.step(user, stepId);
    await this.prisma.harvestStep.update({
      where: { id: step.id },
      data: { weightGrams: input.grams, note: input.note ?? step.note },
    });
    return { id: step.id, removed: false, voided: false };
  }

  async voidStep(user: SessionUser, stepId: string): Promise<RecordRemoved> {
    const step = await this.step(user, stepId);
    await this.prisma.harvestStep.update({
      where: { id: step.id },
      data: { voidedAt: new Date(), voidedByName: user.name },
    });
    return removed(step.id, true);
  }

  async editWaste(user: SessionUser, wasteId: string, input: WeightEdit): Promise<RecordRemoved> {
    const waste = await this.waste(user, wasteId);
    await this.prisma.harvestWaste.update({
      where: { id: waste.id },
      data: { weightGrams: input.grams, note: input.note ?? waste.note },
    });
    return { id: waste.id, removed: false, voided: false };
  }

  async voidWaste(user: SessionUser, wasteId: string): Promise<RecordRemoved> {
    const waste = await this.waste(user, wasteId);
    await this.prisma.harvestWaste.update({
      where: { id: waste.id },
      data: { voidedAt: new Date(), voidedByName: user.name },
    });
    return removed(waste.id, true);
  }

  async editPackage(user: SessionUser, packageId: string, input: PackageEdit): Promise<RecordRemoved> {
    const row = await this.pack(user, packageId);
    try {
      await this.prisma.harvestPackage.update({ where: { id: row.id }, data: { label: input.label } });
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A package with that label already exists on this license.');
      }
      throw error;
    }
    return { id: row.id, removed: false, voided: false };
  }

  async voidPackage(user: SessionUser, packageId: string): Promise<RecordRemoved> {
    const row = await this.pack(user, packageId);
    await this.prisma.harvestPackage.update({
      where: { id: row.id },
      data: { voidedAt: new Date(), voidedByName: user.name },
    });
    return removed(row.id, true);
  }

  async editSubmission(user: SessionUser, submissionId: string, input: SubmissionEdit): Promise<RecordRemoved> {
    const row = await this.submission(user, submissionId);
    await this.prisma.metrcSubmission.update({ where: { id: row.id }, data: { rejectionNote: input.rejectionNote } });
    return { id: row.id, removed: false, voided: false };
  }

  async voidSubmission(user: SessionUser, submissionId: string): Promise<RecordRemoved> {
    const row = await this.submission(user, submissionId);
    await this.prisma.metrcSubmission.update({
      where: { id: row.id },
      data: { voidedAt: new Date(), voidedByName: user.name },
    });
    return removed(row.id, true);
  }

  async editPlant(user: SessionUser, plantId: string, input: PlantEdit): Promise<RecordRemoved> {
    const plant = await this.plant(user, plantId);
    await this.prisma.plant.update({ where: { id: plant.id }, data: { stage: input.stage } });
    return { id: plant.id, removed: false, voided: false };
  }

  async voidPlant(user: SessionUser, plantId: string): Promise<RecordRemoved> {
    const plant = await this.plant(user, plantId);
    await this.prisma.$transaction([
      this.prisma.plant.update({
        where: { id: plant.id },
        data: { voidedAt: new Date(), voidedByName: user.name, status: 'voided' },
      }),
      this.prisma.plantEvent.create({
        data: {
          plantId: plant.id,
          licenseId: plant.licenseId,
          eventType: 'voided',
          actorUserId: user.id,
          occurredAt: new Date(),
          note: 'Removed from the active list.',
        },
      }),
    ]);
    return removed(plant.id, true);
  }

  async addBatch(user: SessionUser, licenseId: string, input: BatchInput): Promise<RecordRemoved> {
    const license = await this.license(user, licenseId);
    const strain = await this.prisma.strain.upsert({
      where: { organizationId_name: { organizationId: license.organizationId, name: input.strainName } },
      update: {},
      create: { organizationId: license.organizationId, name: input.strainName },
    });
    try {
      const batch = await this.prisma.plantBatch.create({
        data: { licenseId: license.id, strainId: strain.id, name: input.name },
      });
      return { id: batch.id, removed: false, voided: false };
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A batch with that name already exists on this license.');
      }
      throw error;
    }
  }

  async editBatch(user: SessionUser, batchId: string, input: BatchInput): Promise<RecordRemoved> {
    const batch = await this.batch(user, batchId);
    await this.prisma.plantBatch.update({ where: { id: batch.id }, data: { name: input.name } });
    return { id: batch.id, removed: false, voided: false };
  }

  async deleteBatch(user: SessionUser, batchId: string): Promise<RecordRemoved> {
    const batch = await this.batch(user, batchId);
    const plants = await this.prisma.plant.count({ where: { batchId: batch.id, voidedAt: null } });
    if (plants > 0) {
      throw new BadRequestException('This batch still has plants on the active list.');
    }
    await this.prisma.plantBatch.delete({ where: { id: batch.id } });
    return removed(batch.id, false);
  }

  async addPlant(user: SessionUser, licenseId: string, input: PlantCreate): Promise<RecordRemoved> {
    const license = await this.license(user, licenseId);
    const batch = await this.prisma.plantBatch.findUnique({ where: { id: input.batchId } });
    if (!batch || batch.licenseId !== license.id) {
      throw new BadRequestException('That batch is not on this license.');
    }
    try {
      const plant = await this.prisma.plant.create({
        data: {
          licenseId: license.id,
          batchId: batch.id,
          strainId: batch.strainId,
          tag: input.tag,
          stage: input.stage,
          status: 'active',
        },
      });
      await this.prisma.plantEvent.create({
        data: {
          plantId: plant.id,
          licenseId: license.id,
          eventType: 'planted',
          actorUserId: user.id,
          occurredAt: new Date(),
          note: 'Added from the license list.',
        },
      });
      return { id: plant.id, removed: false, voided: false };
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('That tag is already on this license.');
      }
      throw error;
    }
  }

  private async cycle(user: SessionUser, cycleId: string) {
    const cycle = await this.prisma.cropCycle.findUnique({ where: { id: cycleId }, include: { room: { include: { site: true } } } });
    if (!cycle) {
      throw new NotFoundException('Crop cycle not found');
    }
    assertSiteAccess(user, cycle.room.site);
    return cycle;
  }

  private async task(user: SessionUser, taskId: string) {
    const task = await this.prisma.cycleTask.findUnique({ where: { id: taskId }, include: { room: { include: { site: true } } } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    assertSiteAccess(user, task.room.site);
    return task;
  }

  private async reading(user: SessionUser, readingId: string) {
    const reading = await this.prisma.environmentalReading.findUnique({ where: { id: readingId }, include: { room: { include: { site: true } } } });
    if (!reading) {
      throw new NotFoundException('Reading not found');
    }
    assertSiteAccess(user, reading.room.site);
    return reading;
  }

  private async rule(user: SessionUser, ruleId: string) {
    const rule = await this.prisma.alertRule.findUnique({ where: { id: ruleId }, include: { room: { include: { site: true } } } });
    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }
    assertSiteAccess(user, rule.room.site);
    return rule;
  }

  private async harvest(user: SessionUser, harvestId: string) {
    const harvest = await this.prisma.harvest.findUnique({
      where: { id: harvestId },
      include: { license: { include: { sites: true } } },
    });
    if (!harvest || harvest.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Harvest not found');
    }
    this.cover(user, harvest.license.sites.map((link) => link.siteId), 'You do not have access to this harvest');
    return harvest;
  }

  private async step(user: SessionUser, stepId: string) {
    const step = await this.prisma.harvestStep.findUnique({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException('Harvest weight not found');
    }
    await this.harvest(user, step.harvestId);
    return step;
  }

  private async waste(user: SessionUser, wasteId: string) {
    const waste = await this.prisma.harvestWaste.findUnique({ where: { id: wasteId } });
    if (!waste) {
      throw new NotFoundException('Waste record not found');
    }
    await this.harvest(user, waste.harvestId);
    return waste;
  }

  private async pack(user: SessionUser, packageId: string) {
    const row = await this.prisma.harvestPackage.findUnique({
      where: { id: packageId },
      include: { license: { include: { sites: true } } },
    });
    if (!row || row.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Package not found');
    }
    this.cover(user, row.license.sites.map((link) => link.siteId), 'You do not have access to this package');
    return row;
  }

  private async submission(user: SessionUser, submissionId: string) {
    const row = await this.prisma.metrcSubmission.findUnique({
      where: { id: submissionId },
      include: { license: { include: { sites: true } } },
    });
    if (!row || row.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Submission not found');
    }
    this.cover(user, row.license.sites.map((link) => link.siteId), 'You do not have access to this submission');
    return row;
  }

  private async plant(user: SessionUser, plantId: string) {
    const plant = await this.prisma.plant.findUnique({
      where: { id: plantId },
      include: { license: { include: { sites: true } } },
    });
    if (!plant || plant.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Plant not found');
    }
    this.cover(user, plant.license.sites.map((link) => link.siteId), 'You do not have access to this plant');
    return plant;
  }

  private async batch(user: SessionUser, batchId: string) {
    const batch = await this.prisma.plantBatch.findUnique({
      where: { id: batchId },
      include: { license: { include: { sites: true } } },
    });
    if (!batch || batch.license.organizationId !== user.organizationId) {
      throw new NotFoundException('Batch not found');
    }
    this.cover(user, batch.license.sites.map((link) => link.siteId), 'You do not have access to this batch');
    return batch;
  }

  private async license(user: SessionUser, licenseId: string) {
    const license = await this.prisma.license.findUnique({ where: { id: licenseId }, include: { sites: true } });
    if (!license || license.organizationId !== user.organizationId) {
      throw new NotFoundException('License not found');
    }
    this.cover(user, license.sites.map((link) => link.siteId), 'You do not have access to this license');
    return license;
  }

  private async orgRow(user: SessionUser, id: string, model: 'workflowTemplate' | 'sopRecord', missing: string) {
    const row =
      model === 'workflowTemplate'
        ? await this.prisma.workflowTemplate.findUnique({ where: { id } })
        : await this.prisma.sopRecord.findUnique({ where: { id } });
    if (!row || row.organizationId !== user.organizationId) {
      throw new NotFoundException(missing);
    }
    return row;
  }

  private cover(user: SessionUser, siteIds: string[], denied: string): void {
    if (user.isOrgAdmin) {
      return;
    }
    if (!siteIds.some((siteId) => user.siteIds.includes(siteId))) {
      throw new ForbiddenException(denied);
    }
  }
}

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function isUnique(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}
