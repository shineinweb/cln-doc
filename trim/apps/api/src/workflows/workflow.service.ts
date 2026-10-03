import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ApplyWorkflow,
  CreateSop,
  CreateTeam,
  CreateWorkflowTemplate,
  CycleTaskSummary,
  RescheduleCycle,
  ReschedulePreview,
  RescheduleResult,
  ResetRoom,
  SessionUser,
  StartCycle,
  StartedCycle,
  WorkflowDirectory,
  WorkflowTaskInput,
  WorkflowTemplateView,
  WorkflowVersionInput,
} from '@trim/contracts';
import { Prisma } from '@trim/database';
import { addCalendarDays, calendarDateInTimeZone, calendarDaysBetween, dateKeyFromDbDate, dbDateFromKey } from '../cycles/cycle-day';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../storage/attachments.service';
import { assertManager } from './manager';

const versionInclude = {
  tasks: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      checklist: { orderBy: { sortOrder: 'asc' as const } },
      team: true,
      role: true,
      assignee: true,
      sopRecord: true,
    },
  },
} satisfies Prisma.WorkflowTemplateVersionInclude;

type VersionRecord = Prisma.WorkflowTemplateVersionGetPayload<{ include: typeof versionInclude }>;

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
  ) {}

  async directory(user: SessionUser): Promise<WorkflowDirectory> {
    const [roles, teams, employees, sops, templates] = await Promise.all([
      this.prisma.role.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
      this.prisma.team.findMany({
        where: { organizationId: user.organizationId },
        include: { members: { include: { user: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: 'asc' } }),
      this.prisma.sopRecord.findMany({ where: { organizationId: user.organizationId }, orderBy: { title: 'asc' } }),
      this.prisma.workflowTemplate.findMany({
        where: { organizationId: user.organizationId },
        include: { versions: { include: versionInclude, orderBy: { versionNumber: 'desc' } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      roles: roles.map((role) => ({ id: role.id, name: role.name, key: role.key })),
      teams: teams.map((team) => ({
        id: team.id,
        name: team.name,
        memberNames: team.members.map((member) => member.user.name).sort(),
      })),
      employees: employees.map((employee) => ({ id: employee.id, name: employee.name, email: employee.email })),
      sops: sops.map((sop) => ({ id: sop.id, title: sop.title, summary: sop.summary })),
      templates: templates.map((template) =>
        this.toTemplateView(template.versions, template.id, template.name, template.cultivar, template.medium),
      ),
    };
  }

  async createSop(user: SessionUser, input: CreateSop) {
    assertManager(user);
    try {
      return await this.prisma.sopRecord.create({
        data: { organizationId: user.organizationId, title: input.title, summary: input.summary },
      });
    } catch (error) {
      this.rethrowUnique(error, 'An SOP with that title already exists.');
    }
  }

  async createTeam(user: SessionUser, input: CreateTeam) {
    assertManager(user);
    const members = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId, id: { in: input.memberIds } },
    });
    if (members.length !== new Set(input.memberIds).size) {
      throw new BadRequestException('Every team member must belong to this organization.');
    }
    try {
      return await this.prisma.team.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          members: { create: input.memberIds.map((userId) => ({ userId })) },
        },
      });
    } catch (error) {
      this.rethrowUnique(error, 'A team with that name already exists.');
    }
  }

  async createTemplate(user: SessionUser, input: CreateWorkflowTemplate): Promise<WorkflowTemplateView> {
    assertManager(user);
    await this.assertVersionRefs(user.organizationId, input);
    try {
      const template = await this.prisma.workflowTemplate.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          cultivar: this.optionalLabel(input.cultivar),
          medium: this.optionalLabel(input.medium),
          versions: { create: this.versionCreate(1, input) },
        },
        include: { versions: { include: versionInclude, orderBy: { versionNumber: 'desc' } } },
      });
      return this.toTemplateView(template.versions, template.id, template.name, template.cultivar, template.medium);
    } catch (error) {
      this.rethrowUnique(error, 'A workflow template with that name already exists.');
    }
  }

  async addVersion(user: SessionUser, templateId: string, input: WorkflowVersionInput): Promise<WorkflowTemplateView> {
    assertManager(user);
    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: templateId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!template || template.organizationId !== user.organizationId) {
      throw new NotFoundException('Workflow template not found');
    }
    await this.assertVersionRefs(user.organizationId, input);
    const nextNumber = (template.versions[0]?.versionNumber ?? 0) + 1;
    await this.prisma.workflowTemplateVersion.create({
      data: { templateId: template.id, ...this.versionCreate(nextNumber, input) },
    });
    return this.reloadTemplate(template.id);
  }

  async startCycle(user: SessionUser, input: StartCycle): Promise<StartedCycle> {
    assertManager(user);
    if (input.expectedHarvestDate < input.startDate) {
      throw new BadRequestException('Expected harvest must be on or after the start date.');
    }
    const room = await this.prisma.room.findUnique({ where: { id: input.roomId }, include: { site: true } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const version = await this.loadVersion(user, input.templateVersionId);
    const cycleId = await this.prisma.$transaction(async (tx) => {
      const cycle = await tx.cropCycle.create({
        data: {
          roomId: room.id,
          name: input.name,
          cultivar: input.cultivar,
          plantCount: input.plantCount,
          stage: input.stage,
          startDate: dbDateFromKey(input.startDate),
          expectedHarvestDate: dbDateFromKey(input.expectedHarvestDate),
          status: 'active',
          workflowVersionId: version.id,
          events: {
            create: {
              occurredOn: dbDateFromKey(input.startDate),
              title: 'Cycle opened',
              detail: 'Workflow tasks were generated from the template.',
            },
          },
        },
      });
      await this.writeTasks(tx, cycle.id, cycle.roomId, input.startDate, version);
      return cycle.id;
    });
    return { id: cycleId, tasks: await this.taskSummaries(cycleId) };
  }

  async resetRoom(user: SessionUser, roomId: string, input: ResetRoom): Promise<StartedCycle> {
    assertManager(user);
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        site: true,
        cycles: { where: { status: 'active' }, orderBy: { startDate: 'desc' }, take: 1 },
      },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const current = room.cycles[0] ?? null;
    if (input.harvestDate && !current) {
      throw new BadRequestException('A harvest date needs a crop to close.');
    }
    if (input.harvestDate && current && input.harvestDate < dateKeyFromDbDate(current.startDate)) {
      throw new BadRequestException('Harvest date must be on or after the crop start date.');
    }
    const expectedHarvestDate = addCalendarDays(input.startDate, input.durationDays - 1);
    const versionId = current?.workflowVersionId ?? (await this.defaultVersionId(user.organizationId));
    const version = await this.loadVersion(user, versionId);
    const cycleId = await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.cycleTask.updateMany({
          where: { cycleId: current.id, status: 'open' },
          data: { status: 'archived' },
        });
        await tx.cropCycle.update({
          where: { id: current.id },
          data: {
            status: 'archived',
            ...(input.harvestDate ? { harvestDate: dbDateFromKey(input.harvestDate) } : {}),
          },
        });
        await tx.cycleEvent.create({
          data: {
            cycleId: current.id,
            occurredOn: dbDateFromKey(input.harvestDate ?? calendarDateInTimeZone(new Date(), room.site.timezone)),
            title: 'Archived',
            detail: input.harvestDate
              ? `Room reset. Harvest date ${input.harvestDate}.`
              : 'Room reset. The crop left the active room.',
          },
        });
      }
      const cycle = await tx.cropCycle.create({
        data: {
          roomId: room.id,
          name: input.strain,
          cultivar: input.strain,
          plantCount: input.plantCount,
          stage: input.stage,
          startDate: dbDateFromKey(input.startDate),
          expectedHarvestDate: dbDateFromKey(expectedHarvestDate),
          status: 'active',
          workflowVersionId: version.id,
          events: {
            create: {
              occurredOn: dbDateFromKey(input.startDate),
              title: 'Cycle opened',
              detail: 'The room was reset. Workflow tasks were generated from the template already on this room.',
            },
          },
        },
      });
      await this.writeTasks(tx, cycle.id, cycle.roomId, input.startDate, version);
      return cycle.id;
    });
    return { id: cycleId, tasks: await this.taskSummaries(cycleId) };
  }

  async applyVersion(user: SessionUser, cycleId: string, input: ApplyWorkflow): Promise<StartedCycle> {
    assertManager(user);
    const cycle = await this.loadCycle(user, cycleId);
    const version = await this.loadVersion(user, input.versionId);
    const existing = await this.prisma.cycleTask.findMany({
      where: { cycleId: cycle.id },
      include: { attachments: true },
    });
    const startDate = dateKeyFromDbDate(cycle.startDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.cycleTask.updateMany({ where: { cycleId: cycle.id }, data: { dependsOnTaskId: null } });
      await tx.cycleTask.deleteMany({ where: { cycleId: cycle.id } });
      await this.writeTasks(tx, cycle.id, cycle.roomId, startDate, version);
      await tx.cropCycle.update({ where: { id: cycle.id }, data: { workflowVersionId: version.id } });
    });
    await Promise.all(existing.flatMap((task) => task.attachments.map((file) => this.attachments.delete(file.objectKey).catch(() => undefined))));
    return { id: cycle.id, tasks: await this.taskSummaries(cycle.id) };
  }

  async previewReschedule(user: SessionUser, cycleId: string, input: RescheduleCycle): Promise<ReschedulePreview> {
    assertManager(user);
    const cycle = await this.loadCycle(user, cycleId);
    return this.reschedulePlan(cycle, input.startDate);
  }

  async confirmReschedule(user: SessionUser, cycleId: string, input: RescheduleCycle): Promise<RescheduleResult> {
    assertManager(user);
    const cycle = await this.loadCycle(user, cycleId);
    const plan = this.reschedulePlan(cycle, input.startDate);
    await this.prisma.$transaction(async (tx) => {
      await tx.cropCycle.update({
        where: { id: cycle.id },
        data: {
          startDate: dbDateFromKey(plan.startDate.to),
          expectedHarvestDate: dbDateFromKey(plan.expectedHarvestDate.to),
        },
      });
      for (const task of plan.tasks) {
        await tx.cycleTask.update({
          where: { id: task.id },
          data: { dueOn: dbDateFromKey(task.toDueOn) },
        });
      }
    });
    return {
      persisted: true,
      startDate: plan.startDate.to,
      expectedHarvestDate: plan.expectedHarvestDate.to,
      tasks: await this.taskSummaries(cycle.id),
    };
  }

  private reschedulePlan(
    cycle: Awaited<ReturnType<WorkflowService['loadCycle']>>,
    nextStart: string,
  ): ReschedulePreview {
    const currentStart = dateKeyFromDbDate(cycle.startDate);
    const currentHarvest = dateKeyFromDbDate(cycle.expectedHarvestDate);
    const delta = calendarDaysBetween(currentStart, nextStart);
    const anchoredToStart = cycle.workflowVersion?.startingEvent === 'cycle_start' || cycle.workflowVersion == null;
    return {
      persisted: false,
      startDate: { from: currentStart, to: nextStart },
      expectedHarvestDate: { from: currentHarvest, to: addCalendarDays(currentHarvest, delta) },
      tasks: cycle.cycleTasks.map((task) => {
        const fromDueOn = dateKeyFromDbDate(task.dueOn);
        const toDueOn = anchoredToStart ? addCalendarDays(nextStart, task.offsetDays) : fromDueOn;
        return { id: task.id, title: task.title, fromDueOn, toDueOn };
      }),
    };
  }

  private async writeTasks(
    tx: Prisma.TransactionClient,
    cycleId: string,
    roomId: string,
    startDate: string,
    version: VersionRecord,
  ): Promise<void> {
    const anchor = await this.anchorKey(tx, cycleId, startDate, version.startingEvent);
    const created = new Map<string, string>();
    for (const task of version.tasks) {
      const row = await tx.cycleTask.create({
        data: {
          cycleId,
          roomId,
          sourceTemplateId: task.id,
          taskKey: task.taskKey,
          title: task.title,
          instructions: task.instructions,
          offsetDays: task.offsetDays,
          dueOn: dbDateFromKey(addCalendarDays(anchor, task.offsetDays)),
          assigneeType: task.assigneeType,
          teamId: task.teamId,
          roleId: task.roleId,
          userId: task.userId,
          assigneeLabel: assigneeLabel(task),
          sopRecordId: task.sopRecordId,
          requiresNotes: task.requiresNotes,
          requiresMeasurement: task.requiresMeasurement,
          requiresPhoto: task.requiresPhoto,
          requiresSignOff: task.requiresSignOff,
          requiresApproval: task.requiresApproval,
          checklist: {
            create: task.checklist.map((item) => ({ label: item.label, sortOrder: item.sortOrder })),
          },
        },
      });
      created.set(task.taskKey, row.id);
    }
    for (const task of version.tasks) {
      if (!task.dependsOnKey) {
        continue;
      }
      const taskId = created.get(task.taskKey);
      const dependsOnTaskId = created.get(task.dependsOnKey);
      if (!taskId || !dependsOnTaskId) {
        throw new BadRequestException(`Task ${task.taskKey} depends on a missing task.`);
      }
      await tx.cycleTask.update({ where: { id: taskId }, data: { dependsOnTaskId } });
    }
  }

  private async anchorKey(
    tx: Prisma.TransactionClient,
    cycleId: string,
    startDate: string,
    startingEvent: string,
  ): Promise<string> {
    if (startingEvent === 'cycle_start') {
      return startDate;
    }
    const event = await tx.cycleEvent.findFirst({
      where: { cycleId, title: startingEvent },
      orderBy: { occurredOn: 'asc' },
    });
    if (!event) {
      throw new BadRequestException(`This cycle has no timeline event named "${startingEvent}".`);
    }
    return dateKeyFromDbDate(event.occurredOn);
  }

  private async loadCycle(user: SessionUser, cycleId: string) {
    const cycle = await this.prisma.cropCycle.findUnique({
      where: { id: cycleId },
      include: {
        room: { include: { site: true } },
        workflowVersion: true,
        cycleTasks: { orderBy: [{ dueOn: 'asc' }, { title: 'asc' }] },
      },
    });
    if (!cycle) {
      throw new NotFoundException('Crop cycle not found');
    }
    assertSiteAccess(user, cycle.room.site);
    return cycle;
  }

  private async defaultVersionId(organizationId: string): Promise<string> {
    const template = await this.prisma.workflowTemplate.findFirst({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    const version = template?.versions[0];
    if (!version) {
      throw new BadRequestException('A workflow template is required before this room can be reset.');
    }
    return version.id;
  }

  private async loadVersion(user: SessionUser, versionId: string): Promise<VersionRecord> {
    const version = await this.prisma.workflowTemplateVersion.findUnique({
      where: { id: versionId },
      include: { ...versionInclude, template: true },
    });
    if (!version || version.template.organizationId !== user.organizationId) {
      throw new NotFoundException('Workflow version not found');
    }
    return version;
  }

  private async taskSummaries(cycleId: string): Promise<CycleTaskSummary[]> {
    const tasks = await this.prisma.cycleTask.findMany({
      where: { cycleId },
      orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
    });
    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueOn: dateKeyFromDbDate(task.dueOn),
      status: task.status,
      assigneeLabel: task.assigneeLabel,
      offsetDays: task.offsetDays,
    }));
  }

  private async reloadTemplate(templateId: string): Promise<WorkflowTemplateView> {
    const template = await this.prisma.workflowTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { versions: { include: versionInclude, orderBy: { versionNumber: 'desc' } } },
    });
    return this.toTemplateView(template.versions, template.id, template.name, template.cultivar, template.medium);
  }

  private optionalLabel(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed.length === 0 ? null : trimmed;
  }

  private toTemplateView(
    versions: VersionRecord[],
    id: string,
    name: string,
    cultivar: string | null,
    medium: string | null,
  ): WorkflowTemplateView {
    const current = versions[0];
    if (!current) {
      throw new NotFoundException('Workflow template has no version');
    }
    return {
      id,
      name,
      cultivar,
      medium,
      versionCount: versions.length,
      currentVersion: {
        id: current.id,
        versionNumber: current.versionNumber,
        durationDays: current.durationDays,
        startingEvent: current.startingEvent,
        tasks: current.tasks.map((task) => ({
          id: task.id,
          taskKey: task.taskKey,
          title: task.title,
          offsetDays: task.offsetDays,
          assigneeType: task.assigneeType as WorkflowTemplateView['currentVersion']['tasks'][number]['assigneeType'],
          assigneeLabel: assigneeLabel(task),
          teamId: task.teamId,
          roleId: task.roleId,
          userId: task.userId,
          instructions: task.instructions,
          checklist: task.checklist.map((item) => item.label),
          sop: task.sopRecord ? { id: task.sopRecord.id, title: task.sopRecord.title, summary: task.sopRecord.summary } : null,
          requiresNotes: task.requiresNotes,
          requiresMeasurement: task.requiresMeasurement,
          requiresPhoto: task.requiresPhoto,
          requiresSignOff: task.requiresSignOff,
          dependsOnKey: task.dependsOnKey,
          requiresApproval: task.requiresApproval,
        })),
      },
    };
  }

  private versionCreate(versionNumber: number, input: WorkflowVersionInput) {
    return {
      versionNumber,
      durationDays: input.durationDays,
      startingEvent: input.startingEvent,
      tasks: {
        create: input.tasks.map((task, index) => {
          const assignee = assigneeIds(task);
          return {
            taskKey: task.taskKey,
            title: task.title,
            offsetDays: task.offsetDays,
            sortOrder: index,
            assigneeType: task.assigneeType,
            teamId: assignee.teamId,
            roleId: assignee.roleId,
            userId: assignee.userId,
            instructions: task.instructions,
            sopRecordId: task.sopRecordId ?? null,
            requiresNotes: task.requiresNotes,
            requiresMeasurement: task.requiresMeasurement,
            requiresPhoto: task.requiresPhoto,
            requiresSignOff: task.requiresSignOff,
            dependsOnKey: task.dependsOnKey ?? null,
            requiresApproval: task.requiresApproval,
            checklist: {
              create: task.checklist.map((label, sortOrder) => ({ label, sortOrder })),
            },
          };
        }),
      },
    };
  }

  private async assertVersionRefs(organizationId: string, input: WorkflowVersionInput): Promise<void> {
    const keys = new Set<string>();
    for (const task of input.tasks) {
      if (keys.has(task.taskKey)) {
        throw new BadRequestException(`Task key ${task.taskKey} is used more than once.`);
      }
      keys.add(task.taskKey);
      if (task.offsetDays >= input.durationDays) {
        throw new BadRequestException(`Task ${task.taskKey} falls outside the ${input.durationDays}-day duration.`);
      }
    }
    for (const task of input.tasks) {
      if (!task.dependsOnKey) {
        continue;
      }
      if (task.dependsOnKey === task.taskKey || !keys.has(task.dependsOnKey)) {
        throw new BadRequestException(`Task ${task.taskKey} depends on a task that is not in this version.`);
      }
    }
    const teamIds = input.tasks.flatMap((task) => (task.assigneeType === 'team' && task.teamId ? [task.teamId] : []));
    const roleIds = input.tasks.flatMap((task) => (task.assigneeType === 'role' && task.roleId ? [task.roleId] : []));
    const userIds = input.tasks.flatMap((task) => (task.assigneeType === 'employee' && task.userId ? [task.userId] : []));
    const sopIds = input.tasks.flatMap((task) => (task.sopRecordId ? [task.sopRecordId] : []));
    const [teams, roles, users, sops] = await Promise.all([
      this.prisma.team.findMany({ where: { organizationId, id: { in: teamIds } } }),
      this.prisma.role.findMany({ where: { organizationId, id: { in: roleIds } } }),
      this.prisma.user.findMany({ where: { organizationId, id: { in: userIds } } }),
      this.prisma.sopRecord.findMany({ where: { organizationId, id: { in: sopIds } } }),
    ]);
    if (teams.length !== new Set(teamIds).size || roles.length !== new Set(roleIds).size || users.length !== new Set(userIds).size) {
      throw new BadRequestException('Assignees must belong to this organization.');
    }
    if (sops.length !== new Set(sopIds).size) {
      throw new BadRequestException('The linked SOP was not found.');
    }
    for (const task of input.tasks) {
      assigneeIds(task);
    }
  }

  private rethrowUnique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException(message);
    }
    throw error;
  }
}

function assigneeIds(task: WorkflowTaskInput): { teamId: string | null; roleId: string | null; userId: string | null } {
  if (task.assigneeType === 'team' && task.teamId) {
    return { teamId: task.teamId, roleId: null, userId: null };
  }
  if (task.assigneeType === 'role' && task.roleId) {
    return { teamId: null, roleId: task.roleId, userId: null };
  }
  if (task.assigneeType === 'employee' && task.userId) {
    return { teamId: null, roleId: null, userId: task.userId };
  }
  throw new BadRequestException(`Task ${task.taskKey} needs a ${task.assigneeType} assignee.`);
}

function assigneeLabel(task: {
  assigneeType: string;
  team: { name: string } | null;
  role: { name: string } | null;
  assignee: { name: string } | null;
}): string {
  if (task.assigneeType === 'team') {
    return task.team?.name ?? 'Team';
  }
  if (task.assigneeType === 'role') {
    return task.role?.name ?? 'Role';
  }
  return task.assignee?.name ?? 'Employee';
}
