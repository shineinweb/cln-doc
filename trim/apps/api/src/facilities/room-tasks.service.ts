import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ManagedTask, ManagedTaskInput, RecordRemoved, SessionUser } from '@trim/contracts';
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

  private schedule(input: ManagedTaskInput): { kind: 'one_time' | 'recurring'; cadence: 'daily' | 'weekly' | null } {
    if (input.kind === 'recurring') {
      if (input.cadence !== 'daily' && input.cadence !== 'weekly') {
        throw new BadRequestException('Choose daily or weekly for a recurring task.');
      }
      return { kind: 'recurring', cadence: input.cadence };
    }
    return { kind: 'one_time', cadence: null };
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
    dueOn: dateKeyFromDbDate(row.dueOn),
    assigneeId: row.assigneeUserId,
    assigneeName: row.assigneeUserId ? row.assigneeLabel : null,
  };
}
