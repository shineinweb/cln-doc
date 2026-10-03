import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CropCycleDetail,
  CropCycleSummary,
  EnvironmentalReading,
  MetrcSync,
  OperatingHistory,
  RoomAlert,
  RoomTask,
  SessionUser,
} from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { assertSiteAccess } from '../facilities/site-access';
import { calendarDateInTimeZone, cycleDayNumber, dateKeyFromDbDate } from './cycle-day';

const historyInclude = {
  events: { orderBy: { occurredOn: 'asc' as const } },
  movements: { orderBy: { occurredOn: 'asc' as const } },
  observations: { orderBy: { occurredOn: 'asc' as const } },
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
  observations: Array<{ id: string; occurredOn: Date; authorName: string; body: string }>;
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
  constructor(private readonly prisma: PrismaService) {}

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
  }, timeZone: string): CropCycleSummary {
    const startDate = dateKeyFromDbDate(cycle.startDate);
    return {
      id: cycle.id,
      roomId: cycle.roomId,
      name: cycle.name,
      cultivar: cycle.cultivar,
      plantCount: cycle.plantCount,
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
        authorName: observation.authorName,
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
    activeAlerts: RoomAlert[];
    latestReadings: EnvironmentalReading[];
    lastMetrcSync: MetrcSync | null;
  }> {
    const today = new Date(`${calendarDateInTimeZone(new Date(), timeZone)}T00:00:00.000Z`);
    const [tasks, alerts, readings, sync] = await Promise.all([
      this.prisma.roomTask.findMany({
        where: { roomId, status: 'open', dueOn: today },
        orderBy: { title: 'asc' },
      }),
      this.prisma.roomAlert.findMany({
        where: { roomId, active: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.environmentalReading.findMany({
        where: { roomId },
        orderBy: { recordedAt: 'desc' },
        take: 8,
      }),
      this.prisma.metrcSync.findFirst({
        where: { siteId, status: 'succeeded', succeededAt: { not: null } },
        orderBy: { succeededAt: 'desc' },
      }),
    ]);

    return {
      tasksDueToday: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        dueOn: dateKeyFromDbDate(task.dueOn),
        status: task.status,
      })),
      activeAlerts: alerts.map((alert) => ({ id: alert.id, message: alert.message })),
      latestReadings: readings.map((reading) => ({
        id: reading.id,
        recordedAt: reading.recordedAt.toISOString(),
        metric: reading.metric,
        value: Number(reading.value),
        unit: reading.unit,
        isSample: reading.isSample,
      })),
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
      },
    });
    if (!cycle) {
      throw new NotFoundException('Crop cycle not found');
    }
    assertSiteAccess(user, cycle.room.site);
    return {
      ...this.summary(cycle, cycle.room.site.timezone),
      siteId: cycle.room.site.id,
      siteName: cycle.room.site.name,
      siteTimezone: cycle.room.site.timezone,
      roomName: cycle.room.name,
      operatingHistory: this.history(cycle),
    };
  }
}

export const activeCycleInclude = {
  where: { status: 'active' },
  orderBy: { startDate: 'desc' as const },
  take: 1,
  include: historyInclude,
};
