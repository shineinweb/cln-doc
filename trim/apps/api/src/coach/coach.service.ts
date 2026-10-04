import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  CoachAnswer,
  CoachChatAction,
  CoachChatRequest,
  CoachChatResponse,
  CoachHelper,
  SessionUser,
  SiteCoach,
  WorkspaceNotice,
} from '@trim/contracts';
import { calendarDateInTimeZone, dbDateFromKey } from '../cycles/cycle-day';
import { assertSiteAccess, authorizedSiteWhere } from '../facilities/site-access';
import { EnvironmentService } from '../environment/environment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { OpenAiService } from '../serenity/openai.service';
import { asSerenity } from '../serenity/serenity';

const STATEMENT = 'This is a readiness check of stored rows. It is not a state certification.';

const SUGGESTIONS = [
  'Generate tasks from stored procedures',
  'Train workers on Canopy scout',
  'How do I check irrigation?',
  'Remember that flower rooms prefer 78°F lights-on',
];

const METRIC_LABEL: Record<string, string> = {
  temperature: 'Temperature',
  relative_humidity: 'Relative humidity',
  co2: 'CO₂',
  substrate: 'Substrate',
};

type SopRow = { id: string; title: string; summary: string };
type PersonRow = { id: string; name: string };

@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly environment: EnvironmentService,
    private readonly openai: OpenAiService,
  ) {}

  async forSite(user: SessionUser, siteId: string): Promise<SiteCoach> {
    const site = await this.siteFor(user, siteId);
    await this.ensureSite(site.id, site.organizationId, site.timezone);
    const report = await this.reports.siteReport(user, site.id);
    const [notices, licenses, helper] = await Promise.all([
      this.listNotices([site.id]),
      this.readiness(site.id),
      this.helperContext(site.id, site.organizationId),
    ]);
    return {
      siteId: site.id,
      siteName: site.name,
      cycles: report.cycles,
      notices,
      licenses,
      statement: STATEMENT,
      helper,
    };
  }

  async ask(user: SessionUser, siteId: string, question: string): Promise<CoachAnswer> {
    const site = await this.siteFor(user, siteId);
    const sops = await this.prisma.sopRecord.findMany({
      where: { organizationId: site.organizationId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, summary: true },
    });
    const quoted = quoteSop(question, sops);
    if (quoted.matched) {
      return {
        ...quoted,
        message: asSerenity(`${quoted.title}. ${quoted.summary}`),
      };
    }
    const enriched = await this.askOpenAi(user, site, question, sops, []);
    if (enriched) {
      return { matched: false, title: null, summary: null, message: enriched };
    }
    return { ...quoted, message: asSerenity(quoted.message) };
  }

  async chat(user: SessionUser, siteId: string, body: CoachChatRequest): Promise<CoachChatResponse> {
    const site = await this.siteFor(user, siteId);
    await this.ensureSite(site.id, site.organizationId, site.timezone);
    const helper = await this.helperContext(site.id, site.organizationId);
    const intent = detectIntent(body.message);
    if (intent === 'help') {
      return {
        reply: asSerenity(
          'I can generate room tasks from stored procedures, assign worker training from those procedures, quote a stored procedure when you ask about it, and learn notes you teach me with “Remember that…”. Try “Generate tasks”, “Train workers on Canopy scout”, or ask how to run a procedure.',
        ),
        matchedSopTitle: null,
        matchedSopSummary: null,
        actions: [],
        suggestions: SUGGESTIONS,
      };
    }
    if (intent === 'teach_serenity') {
      return this.learnLesson(user, site.organizationId, body.message);
    }
    if (intent === 'generate_tasks') {
      return this.withSerenityReply(await this.generateTasks(user, site, helper, body.message));
    }
    if (intent === 'train_workers') {
      return this.withSerenityReply(await this.trainWorkers(user, site, helper, body.message));
    }
    const quoted = quoteSop(body.message, helper.sops);
    if (quoted.matched) {
      const openaiReply = await this.askOpenAi(user, site, body.message, helper.sops, body.history ?? [], quoted);
      return {
        reply: openaiReply ?? asSerenity(`${quoted.title}. ${quoted.summary}`),
        matchedSopTitle: quoted.title,
        matchedSopSummary: quoted.summary,
        actions: [],
        suggestions: [
          `Generate tasks for ${quoted.title}`,
          `Train workers on ${quoted.title}`,
          'Generate tasks from stored procedures',
        ],
      };
    }
    const openaiReply = await this.askOpenAi(user, site, body.message, helper.sops, body.history ?? []);
    return {
      reply:
        openaiReply ??
        asSerenity(`${quoted.message} I can still generate tasks, assign training, or learn a note with “Remember that…”.`),
      matchedSopTitle: null,
      matchedSopSummary: null,
      actions: [],
      suggestions: SUGGESTIONS,
    };
  }

  async notices(user: SessionUser): Promise<WorkspaceNotice[]> {
    const sites = await this.prisma.site.findMany({
      where: authorizedSiteWhere(user),
      select: { id: true, organizationId: true, timezone: true },
    });
    for (const site of sites) {
      await this.ensureSite(site.id, site.organizationId, site.timezone);
    }
    return this.listNotices(sites.map((site) => site.id));
  }

  private async generateTasks(
    _user: SessionUser,
    site: { id: string; organizationId: string; timezone: string; name: string },
    helper: CoachHelper,
    message: string,
  ): Promise<CoachChatResponse> {
    if (helper.rooms.length === 0) {
      throw new BadRequestException('This facility has no rooms, so tasks cannot be generated.');
    }
    if (helper.sops.length === 0) {
      throw new BadRequestException('No stored procedures are available to generate tasks from.');
    }
    const matched = quoteSop(message, helper.sops);
    const sops = matched.matched
      ? helper.sops.filter((sop) => sop.title === matched.title)
      : helper.sops.slice(0, Math.min(4, helper.sops.length));
    const dueOn = dbDateFromKey(calendarDateInTimeZone(new Date(), site.timezone));
    const assigneeIds = helper.people.map((person) => person.id);
    const actions: CoachChatAction[] = [];
    for (const sop of sops) {
      const room = helper.rooms[actions.length % helper.rooms.length]!;
      const existing = await this.prisma.roomTask.findFirst({
        where: { roomId: room.id, status: 'open', title: sop.title },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      const created = await this.prisma.roomTask.create({
        data: {
          roomId: room.id,
          title: sop.title.slice(0, 191),
          description: sop.summary,
          kind: 'one_time',
          dueOn,
          status: 'open',
          sopRecordId: sop.id,
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        },
      });
      actions.push({
        type: 'task',
        taskId: created.id,
        roomId: room.id,
        roomName: room.name,
        title: sop.title,
        sopTitle: sop.title,
      });
    }
    if (actions.length === 0) {
      return {
        reply: 'Open tasks already cover those stored procedures for this facility. Nothing new was created.',
        matchedSopTitle: matched.matched ? matched.title : null,
        matchedSopSummary: matched.matched ? matched.summary : null,
        actions: [],
        suggestions: ['Train workers on Canopy scout', 'How do I check irrigation?'],
      };
    }
    const names = actions.map((action) => action.title).join(', ');
    return {
      reply: `Created ${actions.length} ${actions.length === 1 ? 'task' : 'tasks'} from stored procedures: ${names}.`,
      matchedSopTitle: matched.matched ? matched.title : null,
      matchedSopSummary: matched.matched ? matched.summary : null,
      actions,
      suggestions: ['Train workers on those procedures', 'How do I run Canopy scout?'],
    };
  }

  private async trainWorkers(
    user: SessionUser,
    site: { id: string; organizationId: string; timezone: string; name: string },
    helper: CoachHelper,
    message: string,
  ): Promise<CoachChatResponse> {
    if (helper.people.length === 0) {
      throw new BadRequestException('No workers can open this facility, so training cannot be assigned.');
    }
    if (helper.sops.length === 0) {
      throw new BadRequestException('No stored procedures are available for training.');
    }
    const matched = quoteSop(message, helper.sops);
    const sop = matched.matched
      ? helper.sops.find((row) => row.title === matched.title) ?? helper.sops[0]!
      : helper.sops[0]!;
    const trainees = await this.traineesFor(helper.people, site.id, sop.title);
    if (trainees.length === 0) {
      return {
        reply: `Everyone who can open ${site.name} already has training on ${sop.title}.`,
        matchedSopTitle: sop.title,
        matchedSopSummary: sop.summary,
        actions: [],
        suggestions: ['Generate tasks from stored procedures', `How do I run ${sop.title}?`],
      };
    }
    const actions: CoachChatAction[] = [];
    for (const person of trainees) {
      const created = await this.prisma.trainingRecord.create({
        data: {
          siteId: site.id,
          traineeName: person.name,
          title: `${sop.title} training`.slice(0, 191),
          sopTitle: sop.title,
          status: 'assigned',
          completedOn: null,
          actorName: user.name,
        },
      });
      actions.push({
        type: 'training',
        trainingId: created.id,
        traineeName: person.name,
        title: `${sop.title} training`,
        sopTitle: sop.title,
      });
    }
    const names = actions
      .filter((action): action is Extract<CoachChatAction, { type: 'training' }> => action.type === 'training')
      .map((action) => action.traineeName)
      .join(', ');
    return {
      reply: `Assigned ${sop.title} training to ${names}. Open Operations → Training to mark it complete.`,
      matchedSopTitle: sop.title,
      matchedSopSummary: sop.summary,
      actions,
      suggestions: ['Generate tasks from stored procedures', `How do I run ${sop.title}?`],
    };
  }

  private async helperContext(siteId: string, organizationId: string): Promise<CoachHelper> {
    const [rooms, sops, people] = await Promise.all([
      this.prisma.room.findMany({ where: { siteId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      this.prisma.sopRecord.findMany({
        where: { organizationId },
        orderBy: { title: 'asc' },
        select: { id: true, title: true, summary: true },
      }),
      this.namedPeopleFor(organizationId, siteId),
    ]);
    return { rooms, sops, people };
  }

  private async namedPeopleFor(organizationId: string, siteId: string): Promise<PersonRow[]> {
    const ids = await this.peopleFor(organizationId, siteId);
    if (ids.length === 0) {
      return [];
    }
    const people = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return people;
  }

  private async traineesFor(people: PersonRow[], siteId: string, sopTitle: string): Promise<PersonRow[]> {
    const existing = await this.prisma.trainingRecord.findMany({
      where: {
        siteId,
        sopTitle,
        status: { in: ['assigned', 'completed'] },
        traineeName: { in: people.map((person) => person.name) },
      },
      select: { traineeName: true },
    });
    const trained = new Set(existing.map((row) => row.traineeName));
    return people.filter((person) => !trained.has(person.name));
  }

  private withSerenityReply(response: CoachChatResponse): CoachChatResponse {
    return { ...response, reply: asSerenity(response.reply) };
  }

  private async learnLesson(
    user: SessionUser,
    organizationId: string,
    message: string,
  ): Promise<CoachChatResponse> {
    const content = extractLesson(message);
    if (!content) {
      return {
        reply: asSerenity(
          'Tell me what to remember after “Remember that…”, for example “Remember that flower rooms prefer 78°F lights-on”.',
        ),
        matchedSopTitle: null,
        matchedSopSummary: null,
        actions: [],
        suggestions: SUGGESTIONS,
      };
    }
    await this.prisma.serenityLesson.create({
      data: {
        organizationId,
        content: content.slice(0, 2000),
        actorId: user.id,
        actorName: user.name,
      },
    });
    return {
      reply: asSerenity(`I learned this and will use it later: ${content}`),
      matchedSopTitle: null,
      matchedSopSummary: null,
      actions: [],
      suggestions: ['How do I check irrigation?', 'Generate tasks from stored procedures'],
    };
  }

  private async askOpenAi(
    user: SessionUser,
    site: { id: string; name: string; organizationId: string },
    question: string,
    sops: Array<{ title: string; summary: string }>,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    matched?: { title: string | null; summary: string | null },
  ): Promise<string | null> {
    const lessons = await this.prisma.serenityLesson.findMany({
      where: { organizationId: site.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { content: true, actorName: true },
    });
    const context = [
      `Facility: ${site.name}`,
      `Staff asking: ${user.name}`,
      'Stored procedures:',
      ...sops.map((sop) => `- ${sop.title}: ${sop.summary}`),
      lessons.length
        ? `Training notes Serenity was taught:\n${lessons.map((lesson) => `- (${lesson.actorName}) ${lesson.content}`).join('\n')}`
        : 'No training notes yet.',
      matched?.title ? `Matched procedure: ${matched.title} — ${matched.summary}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const reply = await this.openai.complete(site.organizationId, [
      { role: 'user', content: `Facility context:\n${context}` },
      ...history.slice(-12).map((row) => ({ role: row.role, content: row.content })),
      { role: 'user', content: question },
    ]);
    return reply ? asSerenity(reply) : null;
  }

  private async siteFor(user: SessionUser, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    return site;
  }

  private async ensureSite(siteId: string, organizationId: string, timeZone: string): Promise<void> {
    const rooms = await this.prisma.room.findMany({ where: { siteId }, select: { id: true, name: true } });
    const sops = await this.prisma.sopRecord.findMany({
      where: { organizationId },
      select: { id: true, title: true, summary: true },
    });
    const people = await this.peopleFor(organizationId, siteId);
    const dueOn = dbDateFromKey(calendarDateInTimeZone(new Date(), timeZone));
    for (const room of rooms) {
      await this.environment.evaluate(room.id);
      const alerts = await this.prisma.roomAlert.findMany({ where: { roomId: room.id, active: true } });
      for (const alert of alerts) {
        const existing = await this.prisma.roomTask.findUnique({ where: { sourceAlertId: alert.id } });
        if (existing) {
          continue;
        }
        const sop = sopForMetric(alert.metric ?? '', sops);
        const label = metricLabel(alert.metric ?? '');
        const description = [alert.message, sop ? `${sop.title}\n${sop.summary}` : null].filter(Boolean).join('\n\n');
        try {
          await this.prisma.roomTask.create({
            data: {
              roomId: room.id,
              title: `${room.name}: ${label} alert`.slice(0, 191),
              description,
              kind: 'one_time',
              dueOn,
              status: 'open',
              sourceAlertId: alert.id,
              sopRecordId: sop?.id ?? null,
              assignees: { create: people.map((userId) => ({ userId })) },
            },
          });
        } catch (error) {
          if (!isUniqueConflict(error)) {
            throw error;
          }
        }
      }
    }
  }

  private async peopleFor(organizationId: string, siteId: string): Promise<string[]> {
    const [members, orgWide] = await Promise.all([
      this.prisma.siteMembership.findMany({ where: { siteId }, select: { userId: true } }),
      this.prisma.userRole.findMany({
        where: { role: { organizationId, isOrgWide: true } },
        select: { userId: true },
      }),
    ]);
    return [...new Set([...members.map((row) => row.userId), ...orgWide.map((row) => row.userId)])];
  }

  private async listNotices(siteIds: string[]): Promise<WorkspaceNotice[]> {
    if (siteIds.length === 0) {
      return [];
    }
    const alerts = await this.prisma.roomAlert.findMany({
      where: { active: true, room: { siteId: { in: siteIds } } },
      include: {
        room: { include: { site: true } },
        roomTasks: { include: { sopRecord: true } },
      },
      orderBy: [{ room: { name: 'asc' } }, { createdAt: 'asc' }],
    });
    return alerts.flatMap((alert) => {
      const task = alert.roomTasks[0];
      if (!task) {
        return [];
      }
      return [
        {
          alertId: alert.id,
          siteId: alert.room.site.id,
          siteName: alert.room.site.name,
          roomId: alert.room.id,
          roomName: alert.room.name,
          message: alert.message,
          taskId: task.id,
          taskTitle: task.title,
          sopTitle: task.sopRecord?.title ?? null,
          sopSummary: task.sopRecord?.summary ?? null,
        },
      ];
    });
  }

  private async readiness(siteId: string): Promise<SiteCoach['licenses']> {
    const licenses = await this.prisma.license.findMany({
      where: { sites: { some: { siteId } } },
      orderBy: { licenseNumber: 'asc' },
    });
    const rows = [];
    for (const license of licenses) {
      const [plants, discrepancies, pending, packages, harvests] = await Promise.all([
        this.prisma.plant.findMany({ where: { licenseId: license.id, voidedAt: null }, select: { tag: true } }),
        this.prisma.metrcDiscrepancy.count({ where: { licenseId: license.id } }),
        this.prisma.metrcSubmission.count({ where: { licenseId: license.id, status: 'pending_review', voidedAt: null } }),
        this.prisma.harvestPackage.findMany({
          where: { licenseId: license.id, voidedAt: null },
          select: { submissions: { select: { id: true }, take: 1 } },
        }),
        this.prisma.harvest.findMany({
          where: { licenseId: license.id, voidedAt: null },
          select: {
            steps: { where: { kind: 'dry_weight', voidedAt: null }, select: { id: true } },
            wastes: { where: { voidedAt: null }, select: { id: true } },
          },
        }),
      ]);
      const untagged = plants.filter((plant) => plant.tag.trim() === '').length;
      const unqueued = packages.filter((row) => row.submissions.length === 0).length;
      const missingWaste = harvests.filter((harvest) => harvest.steps.length > 0 && harvest.wastes.length === 0).length;
      rows.push({
        licenseId: license.id,
        licenseNumber: license.licenseNumber,
        jurisdiction: license.jurisdiction,
        gaps: [
          gap('untagged_plants', untagged, untagged === 0 ? 'No active plant is missing a tag.' : `${countNoun(untagged, 'active plant has', 'active plants have')} no tag.`),
          gap('discrepancies', discrepancies, discrepancies === 0 ? 'No inventory discrepancies are stored.' : `${countNoun(discrepancies, 'inventory discrepancy is', 'inventory discrepancies are')} stored.`),
          gap('pending_submissions', pending, pending === 0 ? 'No submission is waiting for review.' : `${countNoun(pending, 'submission is', 'submissions are')} waiting for review.`),
          gap('unqueued_packages', unqueued, unqueued === 0 ? 'No package is waiting to be queued.' : `${countNoun(unqueued, 'package has', 'packages have')} not been queued for review.`),
          gap('missing_waste', missingWaste, missingWaste === 0 ? 'No harvest with a dry weight is missing waste.' : `${countNoun(missingWaste, 'harvest has', 'harvests have')} a dry weight and no waste row.`),
        ],
      });
    }
    return rows;
  }
}

function gap(kind: SiteCoach['licenses'][number]['gaps'][number]['kind'], count: number, detail: string) {
  return { kind, count, detail };
}

function countNoun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function quoteSop(question: string, sops: Array<{ title: string; summary: string }>): CoachAnswer {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  let best: { title: string; summary: string; score: number } | null = null;
  for (const sop of sops) {
    const title = sop.title.toLowerCase();
    const summary = sop.summary.toLowerCase();
    const titleHits = words.filter((word) => title.includes(word)).length;
    const summaryHits = words.filter((word) => summary.includes(word)).length;
    const score = titleHits * 3 + summaryHits;
    if (score > 0 && (!best || score > best.score)) {
      best = { title: sop.title, summary: sop.summary, score };
    }
  }
  if (!best) {
    return { matched: false, title: null, summary: null, message: 'No stored procedure matches that question.' };
  }
  return { matched: true, title: best.title, summary: best.summary, message: best.summary };
}

export function detectIntent(
  message: string,
): 'generate_tasks' | 'train_workers' | 'teach_serenity' | 'help' | 'ask' {
  const text = message.toLowerCase();
  if (/\b(help|what can you do|capabilities|who are you)\b/.test(text)) {
    return 'help';
  }
  if (
    /\b(remember that|remember this|learn that|learn this|note that|from now on|train yourself|train serenity)\b/.test(
      text,
    )
  ) {
    return 'teach_serenity';
  }
  if (/\b(train|training|onboard|teach)\b/.test(text) && /\b(worker|workers|staff|team|people|operator|operators|blake|casey|avery)\b/.test(text)) {
    return 'train_workers';
  }
  if (/\btrain(ing)?\b/.test(text) && /\bon\b/.test(text)) {
    return 'train_workers';
  }
  if (/\b(generate|create|make|assign|open)\b/.test(text) && /\b(task|tasks)\b/.test(text)) {
    return 'generate_tasks';
  }
  if (/\bgenerate tasks\b/.test(text) || text.trim() === 'tasks') {
    return 'generate_tasks';
  }
  return 'ask';
}

function extractLesson(message: string): string {
  const patterns = [
    /^\s*remember\s+(?:that|this)\s*[:,-]?\s*(.+)$/i,
    /^\s*learn\s+(?:that|this)\s*[:,-]?\s*(.+)$/i,
    /^\s*note\s+that\s*[:,-]?\s*(.+)$/i,
    /^\s*from\s+now\s+on\s*[:,-]?\s*(.+)$/i,
    /^\s*train\s+(?:yourself|serenity)\s*[:,-]?\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return message.replace(/^\s*(remember|learn|note|train yourself|train serenity)\b[:\s-]*/i, '').trim();
}

function sopForMetric(metric: string, sops: SopRow[]): SopRow | null {
  const label = metricLabel(metric).toLowerCase();
  const spaced = metric.replaceAll('_', ' ').toLowerCase();
  const hits = sops.filter((sop) => {
    const title = sop.title.toLowerCase();
    if (title.length < 4) {
      return false;
    }
    return title.includes(label) || title.includes(spaced) || label.includes(title) || spaced.includes(title);
  });
  hits.sort((left, right) => left.title.length - right.title.length);
  return hits[0] ?? null;
}

function metricLabel(metric: string): string {
  return METRIC_LABEL[metric] ?? metric;
}

function isUniqueConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002';
}
