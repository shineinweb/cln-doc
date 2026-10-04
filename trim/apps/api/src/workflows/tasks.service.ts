import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CycleTaskDetail, SessionUser, TaskChecklistInput, TaskCommentInput, TaskEvidenceInput, WorkspaceToday } from '@trim/contracts';
import { calendarDateInTimeZone, dateKeyFromDbDate } from '../cycles/cycle-day';
import { assertSiteAccess, authorizedSiteWhere } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { CoachService } from '../coach/coach.service';
import { AttachmentsService } from '../storage/attachments.service';

const taskInclude = {
  checklist: { orderBy: { sortOrder: 'asc' as const } },
  comments: { orderBy: { createdAt: 'asc' as const } },
  attachments: { orderBy: { createdAt: 'asc' as const } },
  dependsOn: true,
  sopRecord: true,
  cycle: true,
  room: { include: { site: true } },
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly coach: CoachService,
  ) {}

  async workspace(user: SessionUser): Promise<WorkspaceToday> {
    const context = await this.assignmentContext(user.id);
    const siteWhere = authorizedSiteWhere(user);
    const [tasks, roomTaskRows, dutyRows] = await Promise.all([
      this.prisma.cycleTask.findMany({
        where: { status: 'open', room: { site: siteWhere } },
        include: taskInclude,
        orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.roomTask.findMany({
        where: { status: 'open', room: { site: siteWhere } },
        include: {
          assignees: { include: { user: { select: { id: true, name: true } } } },
          room: { include: { site: true } },
          sourceAlert: { select: { id: true } },
          sopRecord: { select: { id: true } },
        },
        orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
      }),
      this.prisma.recurringDuty.findMany({
        where: { site: siteWhere },
        include: { room: true, site: true },
        orderBy: [{ nextDueOn: 'asc' }, { title: 'asc' }],
      }),
    ]);
    const visible = tasks.filter((task) => {
      const today = calendarDateInTimeZone(new Date(), task.room.site.timezone);
      return dateKeyFromDbDate(task.dueOn) === today && this.isAssigned(user, task, context);
    });
    const roomTasks = roomTaskRows
      .filter((task) => {
        const today = calendarDateInTimeZone(new Date(), task.room.site.timezone);
        const assigned =
          user.isOrgAdmin || task.assignees.some((assignment) => assignment.userId === user.id);
        if (!assigned) {
          return false;
        }
        if (task.kind === 'recurring') {
          if (task.cadence === 'daily') {
            return true;
          }
          if (task.cadence === 'weekly') {
            return weekdayKeyInTimeZone(new Date(), task.room.site.timezone, task.weekdays);
          }
          return false;
        }
        return task.dueOn != null && dateKeyFromDbDate(task.dueOn) === today;
      })
      .map((task) => {
        const cadence: 'daily' | 'weekly' | null =
          task.cadence === 'daily' || task.cadence === 'weekly' ? task.cadence : null;
        return {
          id: task.id,
          title: task.title,
          description: task.description?.trim() ? task.description.trim() : null,
          kind: task.kind === 'recurring' ? ('recurring' as const) : ('one_time' as const),
          cadence,
          dueOn: task.dueOn ? dateKeyFromDbDate(task.dueOn) : null,
          roomId: task.roomId,
          roomName: task.room.name,
          siteId: task.room.siteId,
          siteName: task.room.site.name,
          source: task.sourceAlertId ? ('alert' as const) : task.sopRecordId ? ('ai' as const) : ('manual' as const),
          assignees: [...task.assignees]
            .map((assignment) => ({ id: assignment.user.id, name: assignment.user.name }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        };
      });
    const duties = dutyRows
      .filter((duty) => {
        const today = calendarDateInTimeZone(new Date(), duty.site.timezone);
        return dateKeyFromDbDate(duty.nextDueOn) <= today;
      })
      .map((duty) => ({
        id: duty.id,
        title: duty.title,
        cadence: duty.cadence === 'weekly' ? ('weekly' as const) : ('daily' as const),
        nextDueOn: dateKeyFromDbDate(duty.nextDueOn),
        assigneeLabel: duty.assigneeLabel,
        sopTitle: duty.sopTitle,
        roomId: duty.roomId,
        roomName: duty.room?.name ?? null,
        siteId: duty.siteId,
        siteName: duty.site.name,
      }));
    const date = visible[0]
      ? dateKeyFromDbDate(visible[0].dueOn)
      : calendarDateInTimeZone(new Date(), 'America/Los_Angeles');
    return {
      date,
      statement:
        'Tasks due today from crop cycles, room chores (including AI and alert follow-ups), and Operations recurring duties. Training stays under Operations → Training.',
      tasks: visible.map((task) => this.toDetail(task)),
      roomTasks,
      duties,
      notices: await this.coach.notices(user),
    };
  }

  async getTask(user: SessionUser, taskId: string): Promise<CycleTaskDetail> {
    const task = await this.loadTask(user, taskId);
    return this.toDetail(task);
  }

  async complete(user: SessionUser, taskId: string): Promise<CycleTaskDetail> {
    const task = await this.loadTask(user, taskId);
    if (task.status !== 'done') {
      await this.prisma.cycleTask.update({
        where: { id: task.id },
        data: { status: 'done' },
      });
    }
    return this.getTask(user, taskId);
  }

  async comment(user: SessionUser, taskId: string, input: TaskCommentInput): Promise<CycleTaskDetail> {
    await this.loadTask(user, taskId);
    await this.prisma.cycleTaskComment.create({
      data: { taskId, authorId: user.id, authorName: user.name, body: input.body },
    });
    return this.getTask(user, taskId);
  }

  async checklist(user: SessionUser, taskId: string, input: TaskChecklistInput): Promise<CycleTaskDetail> {
    await this.loadTask(user, taskId);
    const item = await this.prisma.cycleTaskChecklistItem.findFirst({ where: { id: input.itemId, taskId } });
    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }
    await this.prisma.cycleTaskChecklistItem.update({
      where: { id: item.id },
      data: { checked: input.checked },
    });
    return this.getTask(user, taskId);
  }

  async evidence(user: SessionUser, taskId: string, input: TaskEvidenceInput): Promise<CycleTaskDetail> {
    await this.loadTask(user, taskId);
    await this.prisma.cycleTask.update({
      where: { id: taskId },
      data: {
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.measurementValue !== undefined ? { measurementValue: input.measurementValue } : {}),
        ...(input.measurementUnit !== undefined ? { measurementUnit: input.measurementUnit } : {}),
        ...(input.signOff === true ? { signedOffAt: new Date(), signedOffByName: user.name } : {}),
        ...(input.signOff === false ? { signedOffAt: null, signedOffByName: null } : {}),
      },
    });
    return this.getTask(user, taskId);
  }

  async addAttachment(
    user: SessionUser,
    taskId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ): Promise<CycleTaskDetail> {
    if (!file || file.size === 0) {
      throw new BadRequestException('Choose a photo to upload.');
    }
    if (!IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Photos must be JPEG, PNG, WebP, or GIF.');
    }
    const task = await this.loadTask(user, taskId);
    const fileName = safeFileName(file.originalname);
    const attachment = await this.prisma.cycleTaskAttachment.create({
      data: {
        taskId,
        objectKey: 'pending',
        fileName,
        contentType: file.mimetype,
        byteSize: file.size,
        uploadedById: user.id,
      },
    });
    const objectKey = `sites/${task.room.siteId}/tasks/${taskId}/${attachment.id}-${fileName}`;
    try {
      await this.attachments.put(objectKey, file.buffer, file.mimetype);
      await this.prisma.cycleTaskAttachment.update({ where: { id: attachment.id }, data: { objectKey } });
    } catch (error) {
      await this.prisma.cycleTaskAttachment.delete({ where: { id: attachment.id } });
      throw error;
    }
    return this.getTask(user, taskId);
  }

  async readAttachment(user: SessionUser, taskId: string, attachmentId: string): Promise<{
    fileName: string;
    contentType: string;
    body: Buffer;
  }> {
    await this.loadTask(user, taskId);
    const attachment = await this.prisma.cycleTaskAttachment.findFirst({ where: { id: attachmentId, taskId } });
    if (!attachment || attachment.objectKey === 'pending') {
      throw new NotFoundException('Attachment not found');
    }
    const body = await this.attachments.get(attachment.objectKey);
    return { fileName: attachment.fileName, contentType: attachment.contentType, body };
  }

  private async loadTask(user: SessionUser, taskId: string) {
    const task = await this.prisma.cycleTask.findUnique({ where: { id: taskId }, include: taskInclude });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    assertSiteAccess(user, task.room.site);
    const context = await this.assignmentContext(user.id);
    if (!this.isAssigned(user, task, context)) {
      throw new ForbiddenException('This assignment is not yours.');
    }
    return task;
  }

  private async assignmentContext(userId: string): Promise<{ roleIds: string[]; teamIds: string[] }> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: true, teamMemberships: true },
    });
    return {
      roleIds: record?.userRoles.map((role) => role.roleId) ?? [],
      teamIds: record?.teamMemberships.map((membership) => membership.teamId) ?? [],
    };
  }

  private isAssigned(
    user: SessionUser,
    task: { assigneeType: string; userId: string | null; roleId: string | null; teamId: string | null },
    context: { roleIds: string[]; teamIds: string[] },
  ): boolean {
    if (user.isOrgAdmin) {
      return true;
    }
    if (task.assigneeType === 'employee') {
      return task.userId === user.id;
    }
    if (task.assigneeType === 'role') {
      return task.roleId != null && context.roleIds.includes(task.roleId);
    }
    if (task.assigneeType === 'team') {
      return task.teamId != null && context.teamIds.includes(task.teamId);
    }
    return false;
  }

  private toDetail(task: Awaited<ReturnType<TasksService['loadTask']>>): CycleTaskDetail {
    return {
      id: task.id,
      cycleId: task.cycleId,
      cycleName: task.cycle.name,
      roomId: task.roomId,
      roomName: task.room.name,
      siteId: task.room.siteId,
      siteName: task.room.site.name,
      title: task.title,
      instructions: task.instructions,
      dueOn: dateKeyFromDbDate(task.dueOn),
      status: task.status,
      assigneeType: task.assigneeType as CycleTaskDetail['assigneeType'],
      assigneeLabel: task.assigneeLabel,
      checklist: task.checklist.map((item) => ({ id: item.id, label: item.label, checked: item.checked })),
      requiresNotes: task.requiresNotes,
      requiresMeasurement: task.requiresMeasurement,
      requiresPhoto: task.requiresPhoto,
      requiresSignOff: task.requiresSignOff,
      requiresApproval: task.requiresApproval,
      dependsOnTitle: task.dependsOn?.title ?? null,
      sop: task.sopRecord ? { id: task.sopRecord.id, title: task.sopRecord.title, summary: task.sopRecord.summary } : null,
      notes: task.notes,
      measurementValue: task.measurementValue == null ? null : Number(task.measurementValue),
      measurementUnit: task.measurementUnit,
      signedOffAt: task.signedOffAt?.toISOString() ?? null,
      signedOffByName: task.signedOffByName,
      comments: task.comments.map((comment) => ({
        id: comment.id,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
      })),
      attachments: task.attachments
        .filter((file) => file.objectKey !== 'pending')
        .map((file) => ({
          id: file.id,
          fileName: file.fileName,
          contentType: file.contentType,
          byteSize: file.byteSize,
        })),
    };
  }
}

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'photo';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
  return cleaned || 'photo';
}

function weekdayKeyInTimeZone(instant: Date, timeZone: string, weekdays: string | null): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).formatToParts(instant);
  const short = parts.find((part) => part.type === 'weekday')?.value?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    sun: 'sun',
    mon: 'mon',
    tue: 'tue',
    wed: 'wed',
    thu: 'thu',
    fri: 'fri',
    sat: 'sat',
  };
  const key = map[short.slice(0, 3)];
  if (!key) {
    return false;
  }
  const chosen = new Set((weekdays ?? '').split(',').map((day) => day.trim()).filter(Boolean));
  return chosen.has(key);
}
