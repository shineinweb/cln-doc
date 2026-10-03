import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ManagedTask, ManagedTaskInput, RecordRemoved, SessionUser, Weekday } from '@trim/contracts';
import { dateKeyFromDbDate, dbDateFromKey } from '../cycles/cycle-day';
import { PrismaService } from '../prisma/prisma.service';
import { assigneeForSite } from './assignee';
import { assertSiteAccess } from './site-access';

@Injectable()
export class RoomTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(roomId: string): Promise<ManagedTask[]> {
    const rows = await this.prisma.roomTask.findMany({
      where: { roomId, status: 'open' },
      orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
    });
    return rows.map(toManagedTask);
  }

  async create(user: SessionUser, roomId: string, input: ManagedTaskInput): Promise<ManagedTask> {
    const room = await this.room(user, roomId);
    const schedule = this.schedule(input);
    const assignee = await assigneeForSite(this.prisma, user.organizationId, room.siteId, input.assigneeId);
    const created = await this.prisma.roomTask.create({
      data: {
        roomId: room.id,
        title: input.title,
        kind: schedule.kind,
        cadence: schedule.cadence,
        weekdays: schedule.weekdays,
        dueOn: dbDateFromKey(input.dueOn),
        status: 'open',
        assigneeUserId: assignee?.id ?? null,
        assigneeLabel: assignee?.name ?? 'Unassigned',
      },
    });
    return toManagedTask(created);
  }

  async update(user: SessionUser, roomId: string, taskId: string, input: ManagedTaskInput): Promise<ManagedTask> {
    const room = await this.room(user, roomId);
    const existing = await this.owned(room.id, taskId);
    const schedule = this.schedule(input);
    const assignee = await assigneeForSite(this.prisma, user.organizationId, room.siteId, input.assigneeId);
    const updated = await this.prisma.roomTask.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        kind: schedule.kind,
        cadence: schedule.cadence,
        weekdays: schedule.weekdays,
        dueOn: dbDateFromKey(input.dueOn),
        assigneeUserId: assignee?.id ?? null,
        assigneeLabel: assignee?.name ?? 'Unassigned',
      },
    });
    return toManagedTask(updated);
  }

  async remove(user: SessionUser, roomId: string, taskId: string): Promise<RecordRemoved> {
    const room = await this.room(user, roomId);
    const existing = await this.owned(room.id, taskId);
    await this.prisma.roomTask.delete({ where: { id: existing.id } });
    return { id: existing.id, removed: true, voided: false };
  }

  private schedule(input: ManagedTaskInput): { kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly' | null; weekdays: string | null } {
    if (input.kind === 'recurring') {
      if (input.cadence !== 'daily' && input.cadence !== 'weekly') {
        throw new BadRequestException('Choose daily or weekly for a recurring task.');
      }
      if (input.cadence === 'daily') {
        return { kind: 'recurring', cadence: 'daily', weekdays: null };
      }
      const weekdays = normalizeWeekdays(input.weekdays);
      if (weekdays.length === 0) {
        throw new BadRequestException('Choose at least one day of the week.');
      }
      const dueDay = weekdayOf(input.dueOn);
      if (!weekdays.includes(dueDay)) {
        throw new BadRequestException('Next due must be one of the selected days.');
      }
      return { kind: 'recurring', cadence: 'weekly', weekdays: weekdays.join(',') };
    }
    return { kind: 'one_time', cadence: null, weekdays: null };
  }

  private async room(user: SessionUser, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { site: true } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    return room;
  }

  private async owned(roomId: string, taskId: string) {
    const task = await this.prisma.roomTask.findFirst({ where: { id: taskId, roomId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}

function toManagedTask(row: {
  id: string;
  title: string;
  kind: string;
  cadence: string | null;
  weekdays: string | null;
  dueOn: Date;
  assigneeUserId: string | null;
  assigneeLabel: string;
}): ManagedTask {
  const kind = row.kind === 'recurring' ? 'recurring' : 'one_time';
  const cadence = row.cadence === 'daily' || row.cadence === 'weekly' ? row.cadence : null;
  return {
    id: row.id,
    title: row.title,
    kind,
    cadence,
    weekdays: kind === 'recurring' && cadence === 'weekly' ? parseWeekdays(row.weekdays) : [],
    dueOn: dateKeyFromDbDate(row.dueOn),
    assigneeId: row.assigneeUserId,
    assigneeName: row.assigneeUserId ? row.assigneeLabel : null,
  };
}

const WEEKDAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_FROM_UTC = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function normalizeWeekdays(days: Weekday[] | null | undefined): Weekday[] {
  const chosen = new Set(days ?? []);
  return WEEKDAY_ORDER.filter((day) => chosen.has(day));
}

function parseWeekdays(value: string | null): Weekday[] {
  const chosen = new Set((value ?? '').split(','));
  return WEEKDAY_ORDER.filter((day) => chosen.has(day));
}

function weekdayOf(dateKey: string): Weekday {
  const [year, month, day] = dateKey.split('-').map(Number);
  return WEEKDAY_FROM_UTC[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}
