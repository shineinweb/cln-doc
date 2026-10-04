import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ManagedTask, ManagedTaskInput, RecordRemoved, SessionUser } from '@trim/contracts';
import { dateKeyFromDbDate, dbDateFromKey } from '../cycles/cycle-day';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { assigneesForSite } from './assignee';
import { assertSiteAccess } from './site-access';
import { normalizeWeekdays, parseWeekdays } from './weekdays';

@Injectable()
export class RoomTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(roomId: string): Promise<ManagedTask[]> {
    const rows = await this.prisma.roomTask.findMany({
      where: { roomId, status: 'open' },
      orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
      include: assigneeInclude,
    });
    return rows.map(toManagedTask);
  }

  async create(user: SessionUser, roomId: string, input: ManagedTaskInput): Promise<ManagedTask> {
    const room = await this.room(user, roomId);
    const schedule = this.schedule(input);
    const assignees = await assigneesForSite(this.prisma, user.organizationId, room.siteId, input.assigneeIds);
    const created = await this.prisma.roomTask.create({
      data: {
        roomId: room.id,
        title: input.title,
        description: blankDescription(input.description),
        kind: schedule.kind,
        cadence: schedule.cadence,
        weekdays: schedule.weekdays,
        dueOn: schedule.dueOn,
        status: 'open',
        assignees: { create: assignees.map((person) => ({ userId: person.id })) },
      },
      include: assigneeInclude,
    });
    this.notifications.notifyRoomTaskAssigned({
      assigneeIds: assignees.map((person) => person.id),
      title: created.title,
      roomName: room.name,
      siteName: room.site.name,
      dueOn: created.dueOn ? dateKeyFromDbDate(created.dueOn) : null,
    });
    return toManagedTask(created);
  }

  async update(user: SessionUser, roomId: string, taskId: string, input: ManagedTaskInput): Promise<ManagedTask> {
    const room = await this.room(user, roomId);
    const existing = await this.owned(room.id, taskId);
    const schedule = this.schedule(input);
    const assignees = await assigneesForSite(this.prisma, user.organizationId, room.siteId, input.assigneeIds);
    const updated = await this.prisma.roomTask.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: blankDescription(input.description),
        kind: schedule.kind,
        cadence: schedule.cadence,
        weekdays: schedule.weekdays,
        dueOn: schedule.dueOn,
        assignees: {
          deleteMany: {},
          create: assignees.map((person) => ({ userId: person.id })),
        },
      },
      include: assigneeInclude,
    });
    const previous = new Set(existing.assignees.map((row) => row.userId));
    const newlyAssigned = assignees.map((person) => person.id).filter((id) => !previous.has(id));
    this.notifications.notifyRoomTaskAssigned({
      assigneeIds: newlyAssigned,
      title: updated.title,
      roomName: room.name,
      siteName: room.site.name,
      dueOn: updated.dueOn ? dateKeyFromDbDate(updated.dueOn) : null,
    });
    return toManagedTask(updated);
  }

  async remove(user: SessionUser, roomId: string, taskId: string): Promise<RecordRemoved> {
    const room = await this.room(user, roomId);
    const existing = await this.owned(room.id, taskId);
    await this.prisma.roomTask.delete({ where: { id: existing.id } });
    return { id: existing.id, removed: true, voided: false };
  }

  async complete(user: SessionUser, roomId: string, taskId: string): Promise<ManagedTask> {
    const room = await this.room(user, roomId);
    const existing = await this.owned(room.id, taskId);
    if (existing.kind === 'recurring') {
      throw new BadRequestException('Recurring room tasks stay on the schedule. Delete the task if it should stop.');
    }
    const updated = await this.prisma.roomTask.update({
      where: { id: existing.id },
      data: { status: 'done' },
      include: assigneeInclude,
    });
    return toManagedTask(updated);
  }

  private schedule(input: ManagedTaskInput): { kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly' | null; weekdays: string | null; dueOn: Date | null } {
    if (input.kind === 'recurring') {
      if (input.cadence !== 'daily' && input.cadence !== 'weekly') {
        throw new BadRequestException('Choose daily or weekly for a recurring task.');
      }
      if (input.cadence === 'daily') {
        return { kind: 'recurring', cadence: 'daily', weekdays: null, dueOn: null };
      }
      const weekdays = normalizeWeekdays(input.weekdays);
      if (weekdays.length === 0) {
        throw new BadRequestException('Choose at least one day of the week.');
      }
      return { kind: 'recurring', cadence: 'weekly', weekdays: weekdays.join(','), dueOn: null };
    }
    if (!input.dueOn) {
      throw new BadRequestException('Enter a due date.');
    }
    return { kind: 'one_time', cadence: null, weekdays: null, dueOn: dbDateFromKey(input.dueOn) };
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
    const task = await this.prisma.roomTask.findFirst({
      where: { id: taskId, roomId },
      include: { assignees: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}

function toManagedTask(row: {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  cadence: string | null;
  weekdays: string | null;
  dueOn: Date | null;
  assignees: { user: { id: string; name: string } }[];
}): ManagedTask {
  const kind = row.kind === 'recurring' ? 'recurring' : 'one_time';
  const cadence = row.cadence === 'daily' || row.cadence === 'weekly' ? row.cadence : null;
  return {
    id: row.id,
    title: row.title,
    description: row.description?.trim() ? row.description.trim() : null,
    kind,
    cadence,
    weekdays: kind === 'recurring' && cadence === 'weekly' ? parseWeekdays(row.weekdays) : [],
    dueOn: row.dueOn ? dateKeyFromDbDate(row.dueOn) : null,
    assignees: [...row.assignees]
      .map((assignment) => ({ id: assignment.user.id, name: assignment.user.name }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

const assigneeInclude = { assignees: { include: { user: true } } } as const;

function blankDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
