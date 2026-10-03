import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CycleTaskDetail, SessionUser, TaskChecklistInput, TaskCommentInput, TaskEvidenceInput, WorkspaceToday } from '@trim/contracts';
import { calendarDateInTimeZone, dateKeyFromDbDate } from '../cycles/cycle-day';
import { assertSiteAccess, authorizedSiteWhere } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

  async workspace(user: SessionUser): Promise<WorkspaceToday> {
    const context = await this.assignmentContext(user.id);
    const tasks = await this.prisma.cycleTask.findMany({
      where: { status: 'open', room: { site: authorizedSiteWhere(user) } },
      include: taskInclude,
      orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
    });
    const visible = tasks.filter((task) => {
      const today = calendarDateInTimeZone(new Date(), task.room.site.timezone);
      return dateKeyFromDbDate(task.dueOn) === today && this.isAssigned(user, task, context);
    });
    const date = visible[0]
      ? dateKeyFromDbDate(visible[0].dueOn)
      : calendarDateInTimeZone(new Date(), 'America/Los_Angeles');
    return { date, tasks: visible.map((task) => this.toDetail(task)) };
  }

  async getTask(user: SessionUser, taskId: string): Promise<CycleTaskDetail> {
    const task = await this.loadTask(user, taskId);
    return this.toDetail(task);
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
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 80);
  return cleaned || 'photo';
}
