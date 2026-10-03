import { Injectable } from '@nestjs/common';
import type { CoachAnswer, SessionUser, SiteCoach, WorkspaceNotice } from '@trim/contracts';
import { calendarDateInTimeZone, dbDateFromKey } from '../cycles/cycle-day';
import { assertSiteAccess, authorizedSiteWhere } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { EnvironmentService } from '../environment/environment.service';

const STATEMENT = 'This is a readiness check of stored rows. It is not a state certification.';

const METRIC_LABEL: Record<string, string> = {
  temperature: 'Temperature',
  relative_humidity: 'Relative humidity',
  co2: 'CO₂',
  substrate: 'Substrate',
};

type SopRow = { id: string; title: string; summary: string };

@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly environment: EnvironmentService,
  ) {}

  async forSite(user: SessionUser, siteId: string): Promise<SiteCoach> {
    const site = await this.siteFor(user, siteId);
    await this.ensureSite(site.id, site.organizationId, site.timezone);
    const report = await this.reports.siteReport(user, site.id);
    const [notices, licenses] = await Promise.all([this.listNotices([site.id]), this.readiness(site.id)]);
    return {
      siteId: site.id,
      siteName: site.name,
      cycles: report.cycles,
      notices,
      licenses,
      statement: STATEMENT,
    };
  }

  async ask(user: SessionUser, siteId: string, question: string): Promise<CoachAnswer> {
    const site = await this.siteFor(user, siteId);
    const sops = await this.prisma.sopRecord.findMany({
      where: { organizationId: site.organizationId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, summary: true },
    });
    return quoteSop(question, sops);
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
