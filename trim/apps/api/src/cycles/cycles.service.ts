import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CropCycleDetail,
  CropCycleSummary,
  MetrcSync,
  OperatingHistory,
  RoomNoteInput,
  RoomTask,
  SessionUser,
} from '@trim/contracts';
import { EnvironmentService } from '../environment/environment.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertSiteAccess } from '../facilities/site-access';
import { calendarDateInTimeZone, cycleDayNumber, dateKeyFromDbDate, dbDateFromKey, zonedDateTimeToUtc } from './cycle-day';

const historyInclude = {
  events: { orderBy: { occurredOn: 'asc' as const } },
  movements: { orderBy: { occurredOn: 'asc' as const } },
  observations: { orderBy: [{ occurredAt: 'asc' as const }, { occurredOn: 'asc' as const }] },
  laborEntries: { orderBy: { occurredOn: 'asc' as const } },
  harvestSummary: true,
};

type CycleWithHistory = {
  id: string;
  roomId: string;
  name: string;
  cultivar: string;
  plantCount: number;
  stage: string;
  startDate: Date;
  expectedHarvestDate: Date;
  status: string;
  events: Array<{ id: string; occurredOn: Date; title: string; detail: string | null }>;
  movements: Array<{
    id: string;
    occurredOn: Date;
    fromLabel: string;
    toLabel: string;
    plantCount: number;
    note: string | null;
  }>;
  observations: Array<{ id: string; occurredOn: Date; occurredAt: Date | null; authorName: string; category: string | null; body: string }>;
  laborEntries: Array<{
    id: string;
    occurredOn: Date;
    personName: string;
    hours: { toString(): string } | number;
    note: string | null;
  }>;
  harvestSummary: { id: string; recordedOn: Date; summary: string } | null;
};

@Injectable()
export class CyclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly environment: EnvironmentService,
  ) {}

  summary(cycle: {
    id: string;
    roomId: string;
    name: string;
    cultivar: string;
    plantCount: number;
    stage: string;
    startDate: Date;
    expectedHarvestDate: Date;
    status: string;
    _count: { plants: number };
  }, timeZone: string): CropCycleSummary {
    const startDate = dateKeyFromDbDate(cycle.startDate);
    return {
      id: cycle.id,
      roomId: cycle.roomId,
      name: cycle.name,
      cultivar: cycle.cultivar,
      plantCount: cycle._count.plants,
      stage: cycle.stage,
      startDate,
      expectedHarvestDate: dateKeyFromDbDate(cycle.expectedHarvestDate),
      status: cycle.status,
      cycleDay: cycleDayNumber(startDate, timeZone),
    };
  }

  history(cycle: CycleWithHistory): OperatingHistory {
    return {
      events: cycle.events.map((event) => ({
        id: event.id,
        occurredOn: dateKeyFromDbDate(event.occurredOn),
        title: event.title,
        detail: event.detail,
      })),
      movements: cycle.movements.map((movement) => ({
        id: movement.id,
        occurredOn: dateKeyFromDbDate(movement.occurredOn),
        fromLabel: movement.fromLabel,
        toLabel: movement.toLabel,
        plantCount: movement.plantCount,
        note: movement.note,
      })),
      observations: cycle.observations.map((observation) => ({
        id: observation.id,
        occurredOn: dateKeyFromDbDate(observation.occurredOn),
        occurredAt: observation.occurredAt ? observation.occurredAt.toISOString() : null,
        authorName: observation.authorName,
        category: observation.category,
        body: observation.body,
      })),
      laborEntries: cycle.laborEntries.map((entry) => ({
        id: entry.id,
        occurredOn: dateKeyFromDbDate(entry.occurredOn),
        personName: entry.personName,
        hours: Number(entry.hours),
        note: entry.note,
      })),
      harvestSummary: cycle.harvestSummary
        ? {
            id: cycle.harvestSummary.id,
            recordedOn: dateKeyFromDbDate(cycle.harvestSummary.recordedOn),
            summary: cycle.harvestSummary.summary,
          }
        : null,
    };
  }

  async roomSignals(
    roomId: string,
    siteId: string,
    timeZone: string,
  ): Promise<{
    tasksDueToday: RoomTask[];
    lastMetrcSync: MetrcSync | null;
  } & Awaited<ReturnType<EnvironmentService['dashboard']>>> {
    const today = new Date(`${calendarDateInTimeZone(new Date(), timeZone)}T00:00:00.000Z`);
    const [tasks, sync, environment] = await Promise.all([
      this.prisma.cycleTask.findMany({
        where: { roomId, status: 'open', dueOn: today },
        orderBy: { title: 'asc' },
      }),
      this.prisma.metrcSync.findFirst({
        where: { siteId, status: 'succeeded', succeededAt: { not: null } },
        orderBy: { succeededAt: 'desc' },
      }),
      this.environment.dashboard(roomId),
    ]);

    return {
      tasksDueToday: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueOn: dateKeyFromDbDate(task.dueOn),
        status: task.status,
        assigneeLabel: task.assigneeLabel,
        assigneeId: task.userId,
      })),
      ...environment,
      lastMetrcSync:
        sync?.succeededAt == null
          ? null
          : {
              id: sync.id,
              succeededAt: sync.succeededAt.toISOString(),
              isSample: sync.isSample,
            },
    };
  }

  async getCycle(user: SessionUser, cycleId: string): Promise<CropCycleDetail> {
    const cycle = await this.prisma.cropCycle.findUnique({
      where: { id: cycleId },
      include: {
        ...historyInclude,
        room: { include: { site: true } },
        cycleTasks: { orderBy: [{ dueOn: 'asc' as const }, { title: 'asc' as const }] },
        workflowVersion: {
          include: {
            template: { include: { versions: { orderBy: { versionNumber: 'desc' as const }, take: 1 } } },
          },
        },
        _count: { select: { plants: { where: { voidedAt: null } } } },
      },
    });
    if (!cycle) {
      throw new NotFoundException('Crop cycle not found');
    }
    assertSiteAccess(user, cycle.room.site);
    const latest = cycle.workflowVersion?.template.versions[0];
    return {
      ...this.summary(cycle, cycle.room.site.timezone),
      siteId: cycle.room.site.id,
      siteName: cycle.room.site.name,
      siteTimezone: cycle.room.site.timezone,
      roomName: cycle.room.name,
      operatingHistory: this.history(cycle),
      workflow: cycle.workflowVersion
        ? {
            templateId: cycle.workflowVersion.templateId,
            templateName: cycle.workflowVersion.template.name,
            versionId: cycle.workflowVersion.id,
            versionNumber: cycle.workflowVersion.versionNumber,
            latestVersionId: latest?.id ?? cycle.workflowVersion.id,
            latestVersionNumber: latest?.versionNumber ?? cycle.workflowVersion.versionNumber,
            durationDays: cycle.workflowVersion.durationDays,
            startingEvent: cycle.workflowVersion.startingEvent,
          }
        : null,
      tasks: cycle.cycleTasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueOn: dateKeyFromDbDate(task.dueOn),
        status: task.status,
        assigneeLabel: task.assigneeLabel,
        offsetDays: task.offsetDays,
      })),
    };
  }

  async addRoomNote(user: SessionUser, roomId: string, input: RoomNoteInput) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { site: true } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const cycle = await this.prisma.cropCycle.findFirst({
      where: { roomId: room.id, status: 'active' },
      orderBy: { startDate: 'desc' },
    });
    if (!cycle) {
      throw new BadRequestException('This room has no active crop cycle.');
    }
    const note = input.body.trim();
    if (!note) {
      throw new BadRequestException('Enter a note.');
    }
    if (note.length > 4000) {
      throw new BadRequestException('A note can be at most 4000 characters.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) {
      throw new BadRequestException('Enter a date.');
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.occurredTime)) {
      throw new BadRequestException('Enter a time.');
    }
    const created = await this.prisma.cycleObservation.create({
      data: {
        cycleId: cycle.id,
        occurredOn: dbDateFromKey(input.occurredOn),
        occurredAt: zonedDateTimeToUtc(input.occurredOn, input.occurredTime, room.site.timezone),
        authorName: user.name,
        category: input.category,
        body: note,
      },
    });
    return {
      id: created.id,
      occurredOn: dateKeyFromDbDate(created.occurredOn),
      occurredAt: created.occurredAt ? created.occurredAt.toISOString() : null,
      authorName: created.authorName,
      category: created.category,
      body: created.body,
    };
  }
}

export const activeCycleInclude = {
  where: { status: 'active' },
  orderBy: { startDate: 'desc' as const },
  take: 1,
  include: { ...historyInclude, _count: { select: { plants: { where: { voidedAt: null } } } } },
};
