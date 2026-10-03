import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  IpmInput,
  IrrigationInput,
  MaintenanceInput,
  OperationsOverview,
  PurchaseInput,
  RecurringInput,
  RoomStayInput,
  SanitationInput,
  SessionUser,
  SopLibrary,
  TrainingInput,
} from '@trim/contracts';
import { addCalendarDays, dateKeyFromDbDate, dbDateFromKey } from '../cycles/cycle-day';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';

type OperationKind = 'irrigation' | 'ipm' | 'maintenance' | 'purchasing' | 'sanitation' | 'training' | 'stays' | 'recurring';

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed;
}

function decimal(value: { toString(): string } | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  return Number(value.toString());
}

@Injectable()
export class OperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(user: SessionUser, siteId: string): Promise<OperationsOverview> {
    const site = await this.site(user, siteId);
    const [rooms, irrigation, ipm, maintenance, purchasing, sanitation, training, stays, recurring] = await Promise.all([
      this.prisma.room.findMany({ where: { siteId }, orderBy: { name: 'asc' } }),
      this.prisma.irrigationRecord.findMany({ where: { siteId }, include: { room: true }, orderBy: { recordedOn: 'desc' } }),
      this.prisma.ipmRecord.findMany({ where: { siteId }, include: { room: true }, orderBy: { recordedOn: 'desc' } }),
      this.prisma.maintenanceRecord.findMany({ where: { siteId }, include: { room: true }, orderBy: { recordedOn: 'desc' } }),
      this.prisma.purchaseRecord.findMany({ where: { siteId }, orderBy: { orderedOn: 'desc' } }),
      this.prisma.sanitationRecord.findMany({ where: { siteId }, include: { room: true }, orderBy: { recordedOn: 'desc' } }),
      this.prisma.trainingRecord.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.roomStay.findMany({ where: { siteId }, include: { room: true }, orderBy: { startsOn: 'asc' } }),
      this.prisma.recurringDuty.findMany({ where: { siteId }, include: { room: true }, orderBy: { nextDueOn: 'asc' } }),
    ]);
    return {
      siteId: site.id,
      siteName: site.name,
      rooms: rooms.map((room) => ({ id: room.id, name: room.name })),
      irrigation: irrigation.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        roomName: row.room.name,
        recordedOn: dateKeyFromDbDate(row.recordedOn),
        kind: row.kind as 'irrigation' | 'feed',
        method: row.method,
        volumeLiters: decimal(row.volumeLiters),
        ec: decimal(row.ec),
        ph: decimal(row.ph),
        nutrientName: row.nutrientName,
        note: row.note,
        actorName: row.actorName,
      })),
      ipm: ipm.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        roomName: row.room.name,
        recordedOn: dateKeyFromDbDate(row.recordedOn),
        target: row.target,
        finding: row.finding as 'clear' | 'present',
        response: row.response,
        note: row.note,
        actorName: row.actorName,
      })),
      maintenance: maintenance.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        roomName: row.room?.name ?? null,
        recordedOn: dateKeyFromDbDate(row.recordedOn),
        assetName: row.assetName,
        kind: row.kind as 'preventive' | 'repair',
        summary: row.summary,
        nextDueOn: row.nextDueOn ? dateKeyFromDbDate(row.nextDueOn) : null,
        actorName: row.actorName,
      })),
      purchasing: purchasing.map((row) => ({
        id: row.id,
        vendorName: row.vendorName,
        orderedOn: dateKeyFromDbDate(row.orderedOn),
        status: row.status as 'requested' | 'received',
        description: row.description,
        quantity: decimal(row.quantity) ?? 0,
        unitCostCents: row.unitCostCents,
      })),
      sanitation: sanitation.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        roomName: row.room.name,
        recordedOn: dateKeyFromDbDate(row.recordedOn),
        area: row.area,
        method: row.method,
        outcome: row.outcome as 'done' | 'follow_up',
        actorName: row.actorName,
      })),
      training: training.map((row) => ({
        id: row.id,
        traineeName: row.traineeName,
        title: row.title,
        sopTitle: row.sopTitle,
        status: row.status as 'assigned' | 'completed',
        completedOn: row.completedOn ? dateKeyFromDbDate(row.completedOn) : null,
        actorName: row.actorName,
      })),
      stays: stays.map((row) => ({
        id: row.id,
        roomId: row.roomId,
        roomName: row.room.name,
        label: row.label,
        cultivar: row.cultivar,
        medium: row.medium,
        startsOn: dateKeyFromDbDate(row.startsOn),
        endsOn: dateKeyFromDbDate(row.endsOn),
      })),
      recurring: recurring.map((row) => this.recurringView(row)),
    };
  }

  async addIrrigation(user: SessionUser, siteId: string, input: IrrigationInput) {
    await this.site(user, siteId);
    const room = await this.roomOnSite(siteId, input.roomId);
    const row = await this.prisma.irrigationRecord.create({
      data: {
        siteId,
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        kind: input.kind,
        method: input.method,
        volumeLiters: input.volumeLiters ?? null,
        ec: input.ec ?? null,
        ph: input.ph ?? null,
        nutrientName: blank(input.nutrientName),
        note: blank(input.note),
        actorName: user.name,
      },
      include: { room: true },
    });
    return {
      id: row.id,
      roomId: row.roomId,
      roomName: row.room.name,
      recordedOn: dateKeyFromDbDate(row.recordedOn),
      kind: row.kind,
      method: row.method,
      volumeLiters: decimal(row.volumeLiters),
      ec: decimal(row.ec),
      ph: decimal(row.ph),
      nutrientName: row.nutrientName,
      note: row.note,
      actorName: row.actorName,
    };
  }

  async addIpm(user: SessionUser, siteId: string, input: IpmInput) {
    await this.site(user, siteId);
    const room = await this.roomOnSite(siteId, input.roomId);
    return this.prisma.ipmRecord.create({
      data: {
        siteId,
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        target: input.target,
        finding: input.finding,
        response: input.response,
        note: blank(input.note),
        actorName: user.name,
      },
    });
  }

  async addMaintenance(user: SessionUser, siteId: string, input: MaintenanceInput) {
    await this.site(user, siteId);
    const room = await this.optionalRoom(siteId, input.roomId);
    return this.prisma.maintenanceRecord.create({
      data: {
        siteId,
        roomId: room?.id ?? null,
        recordedOn: dbDateFromKey(input.recordedOn),
        assetName: input.assetName,
        kind: input.kind,
        summary: input.summary,
        nextDueOn: input.nextDueOn ? dbDateFromKey(input.nextDueOn) : null,
        actorName: user.name,
      },
    });
  }

  async addPurchase(user: SessionUser, siteId: string, input: PurchaseInput) {
    await this.site(user, siteId);
    return this.prisma.purchaseRecord.create({
      data: {
        siteId,
        vendorName: input.vendorName,
        orderedOn: dbDateFromKey(input.orderedOn),
        status: input.status,
        description: input.description,
        quantity: input.quantity,
        unitCostCents: input.unitCostCents,
      },
    });
  }

  async addSanitation(user: SessionUser, siteId: string, input: SanitationInput) {
    await this.site(user, siteId);
    const room = await this.roomOnSite(siteId, input.roomId);
    return this.prisma.sanitationRecord.create({
      data: {
        siteId,
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        area: input.area,
        method: input.method,
        outcome: input.outcome,
        actorName: user.name,
      },
    });
  }

  async addTraining(user: SessionUser, siteId: string, input: TrainingInput) {
    await this.site(user, siteId);
    return this.prisma.trainingRecord.create({
      data: {
        siteId,
        traineeName: input.traineeName,
        title: input.title,
        sopTitle: blank(input.sopTitle),
        status: input.status,
        completedOn: input.completedOn ? dbDateFromKey(input.completedOn) : null,
        actorName: user.name,
      },
    });
  }

  async addStay(user: SessionUser, siteId: string, input: RoomStayInput) {
    await this.site(user, siteId);
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException('The stay must end on or after the day it starts.');
    }
    const room = await this.roomOnSite(siteId, input.roomId);
    return this.prisma.roomStay.create({
      data: {
        siteId,
        roomId: room.id,
        label: input.label,
        cultivar: input.cultivar,
        medium: input.medium,
        startsOn: dbDateFromKey(input.startsOn),
        endsOn: dbDateFromKey(input.endsOn),
      },
    });
  }

  async addRecurring(user: SessionUser, siteId: string, input: RecurringInput) {
    await this.site(user, siteId);
    const room = await this.optionalRoom(siteId, input.roomId);
    const row = await this.prisma.recurringDuty.create({
      data: {
        siteId,
        roomId: room?.id ?? null,
        title: input.title,
        cadence: input.cadence,
        nextDueOn: dbDateFromKey(input.nextDueOn),
        assigneeLabel: input.assigneeLabel,
        sopTitle: blank(input.sopTitle),
      },
      include: { room: true },
    });
    return this.recurringView(row);
  }

  async updateIrrigation(user: SessionUser, siteId: string, id: string, input: IrrigationInput) {
    await this.owned(user, siteId, id, 'irrigation');
    const room = await this.roomOnSite(siteId, input.roomId);
    await this.prisma.irrigationRecord.update({
      where: { id },
      data: {
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        kind: input.kind,
        method: input.method,
        volumeLiters: input.volumeLiters,
        ec: input.ec,
        ph: input.ph,
        nutrientName: blank(input.nutrientName),
        note: blank(input.note),
      },
    });
  }

  async updateIpm(user: SessionUser, siteId: string, id: string, input: IpmInput) {
    await this.owned(user, siteId, id, 'ipm');
    const room = await this.roomOnSite(siteId, input.roomId);
    await this.prisma.ipmRecord.update({
      where: { id },
      data: {
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        target: input.target,
        finding: input.finding,
        response: input.response,
        note: blank(input.note),
      },
    });
  }

  async updateMaintenance(user: SessionUser, siteId: string, id: string, input: MaintenanceInput) {
    await this.owned(user, siteId, id, 'maintenance');
    const room = await this.optionalRoom(siteId, input.roomId);
    await this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        roomId: room?.id ?? null,
        recordedOn: dbDateFromKey(input.recordedOn),
        assetName: input.assetName,
        kind: input.kind,
        summary: input.summary,
        nextDueOn: input.nextDueOn ? dbDateFromKey(input.nextDueOn) : null,
      },
    });
  }

  async updatePurchase(user: SessionUser, siteId: string, id: string, input: PurchaseInput) {
    await this.owned(user, siteId, id, 'purchasing');
    await this.prisma.purchaseRecord.update({
      where: { id },
      data: {
        vendorName: input.vendorName,
        orderedOn: dbDateFromKey(input.orderedOn),
        status: input.status,
        description: input.description,
        quantity: input.quantity,
        unitCostCents: input.unitCostCents,
      },
    });
  }

  async updateSanitation(user: SessionUser, siteId: string, id: string, input: SanitationInput) {
    await this.owned(user, siteId, id, 'sanitation');
    const room = await this.roomOnSite(siteId, input.roomId);
    await this.prisma.sanitationRecord.update({
      where: { id },
      data: {
        roomId: room.id,
        recordedOn: dbDateFromKey(input.recordedOn),
        area: input.area,
        method: input.method,
        outcome: input.outcome,
      },
    });
  }

  async updateTraining(user: SessionUser, siteId: string, id: string, input: TrainingInput) {
    await this.owned(user, siteId, id, 'training');
    await this.prisma.trainingRecord.update({
      where: { id },
      data: {
        traineeName: input.traineeName,
        title: input.title,
        sopTitle: blank(input.sopTitle),
        status: input.status,
        completedOn: input.completedOn ? dbDateFromKey(input.completedOn) : null,
      },
    });
  }

  async updateStay(user: SessionUser, siteId: string, id: string, input: RoomStayInput) {
    await this.owned(user, siteId, id, 'stays');
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException('The stay must end on or after the day it starts.');
    }
    const room = await this.roomOnSite(siteId, input.roomId);
    await this.prisma.roomStay.update({
      where: { id },
      data: {
        roomId: room.id,
        label: input.label,
        cultivar: input.cultivar,
        medium: input.medium,
        startsOn: dbDateFromKey(input.startsOn),
        endsOn: dbDateFromKey(input.endsOn),
      },
    });
  }

  async updateRecurring(user: SessionUser, siteId: string, id: string, input: RecurringInput) {
    await this.owned(user, siteId, id, 'recurring');
    const room = await this.optionalRoom(siteId, input.roomId);
    await this.prisma.recurringDuty.update({
      where: { id },
      data: {
        roomId: room?.id ?? null,
        title: input.title,
        cadence: input.cadence,
        nextDueOn: dbDateFromKey(input.nextDueOn),
        assigneeLabel: input.assigneeLabel,
        sopTitle: blank(input.sopTitle),
      },
    });
  }

  async deleteRecord(user: SessionUser, siteId: string, kind: OperationKind, id: string) {
    await this.owned(user, siteId, id, kind);
    await this.removeKind(kind, id);
  }

  async completeRecurring(user: SessionUser, siteId: string, dutyId: string) {
    await this.site(user, siteId);
    const duty = await this.prisma.recurringDuty.findUnique({ where: { id: dutyId }, include: { room: true } });
    if (!duty || duty.siteId !== siteId) {
      throw new NotFoundException('Recurring task not found');
    }
    const next = addCalendarDays(dateKeyFromDbDate(duty.nextDueOn), duty.cadence === 'weekly' ? 7 : 1);
    const updated = await this.prisma.recurringDuty.update({
      where: { id: duty.id },
      data: { nextDueOn: dbDateFromKey(next) },
      include: { room: true },
    });
    return this.recurringView(updated);
  }

  async library(user: SessionUser): Promise<SopLibrary> {
    const sops = await this.prisma.sopRecord.findMany({
      where: { organizationId: user.organizationId },
      include: {
        taskTemplates: { include: { version: { include: { template: true } } } },
        cycleTasks: { include: { room: { include: { site: true } }, cycle: true } },
      },
      orderBy: { title: 'asc' },
    });
    return {
      entries: sops.map((sop) => ({
        id: sop.id,
        title: sop.title,
        summary: sop.summary,
        templateTasks: sop.taskTemplates.map((task) => ({
          templateName: task.version.template.name,
          cultivar: task.version.template.cultivar,
          medium: task.version.template.medium,
          taskTitle: task.title,
        })),
        cycleTasks: sop.cycleTasks
          .filter((task) => user.isOrgAdmin || user.siteIds.includes(task.room.site.id))
          .map((task) => ({
            siteName: task.room.site.name,
            roomName: task.room.name,
            cycleName: task.cycle.name,
            taskTitle: task.title,
          })),
      })),
    };
  }

  private recurringView(row: {
    id: string;
    roomId: string | null;
    title: string;
    cadence: string;
    nextDueOn: Date;
    assigneeLabel: string;
    sopTitle: string | null;
    room: { name: string } | null;
  }) {
    return {
      id: row.id,
      roomId: row.roomId,
      roomName: row.room?.name ?? null,
      title: row.title,
      cadence: row.cadence as 'daily' | 'weekly',
      nextDueOn: dateKeyFromDbDate(row.nextDueOn),
      assigneeLabel: row.assigneeLabel,
      sopTitle: row.sopTitle,
    };
  }

  private async removeKind(kind: OperationKind, id: string) {
    switch (kind) {
      case 'irrigation':
        await this.prisma.irrigationRecord.delete({ where: { id } });
        return;
      case 'ipm':
        await this.prisma.ipmRecord.delete({ where: { id } });
        return;
      case 'maintenance':
        await this.prisma.maintenanceRecord.delete({ where: { id } });
        return;
      case 'purchasing':
        await this.prisma.purchaseRecord.delete({ where: { id } });
        return;
      case 'sanitation':
        await this.prisma.sanitationRecord.delete({ where: { id } });
        return;
      case 'training':
        await this.prisma.trainingRecord.delete({ where: { id } });
        return;
      case 'stays':
        await this.prisma.roomStay.delete({ where: { id } });
        return;
      case 'recurring':
        await this.prisma.recurringDuty.delete({ where: { id } });
        return;
    }
  }

  private async owned(user: SessionUser, siteId: string, id: string, kind: OperationKind) {
    await this.site(user, siteId);
    const row = await this.findKind(kind, id);
    if (!row || row.siteId !== siteId) {
      throw new NotFoundException('Record not found');
    }
    return row;
  }

  private findKind(kind: OperationKind, id: string) {
    switch (kind) {
      case 'irrigation':
        return this.prisma.irrigationRecord.findUnique({ where: { id } });
      case 'ipm':
        return this.prisma.ipmRecord.findUnique({ where: { id } });
      case 'maintenance':
        return this.prisma.maintenanceRecord.findUnique({ where: { id } });
      case 'purchasing':
        return this.prisma.purchaseRecord.findUnique({ where: { id } });
      case 'sanitation':
        return this.prisma.sanitationRecord.findUnique({ where: { id } });
      case 'training':
        return this.prisma.trainingRecord.findUnique({ where: { id } });
      case 'stays':
        return this.prisma.roomStay.findUnique({ where: { id } });
      case 'recurring':
        return this.prisma.recurringDuty.findUnique({ where: { id } });
    }
  }

  private async site(user: SessionUser, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    return site;
  }

  private async roomOnSite(siteId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room || room.siteId !== siteId) {
      throw new BadRequestException('That room is not on this facility.');
    }
    return room;
  }

  private async optionalRoom(siteId: string, roomId: string | null | undefined) {
    if (!roomId) {
      return null;
    }
    return this.roomOnSite(siteId, roomId);
  }
}
