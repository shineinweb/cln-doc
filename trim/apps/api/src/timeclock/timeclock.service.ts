import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  LaborRateInput,
  LaborRateView,
  PayrollAnswer,
  PayrollAsk,
  PayrollEmployee,
  PayrollReport,
  SessionUser,
  TimeClockStatus,
  TimePresenceList,
  TimePunch,
  TimePunchInput,
  TimePunchKind,
} from '@trim/contracts';
import { calendarDateInTimeZone, dateKeyFromDbDate, dbDateFromKey, zonedDateTimeToUtc } from '../cycles/cycle-day';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';

const OT_DAILY_MINUTES = 8 * 60;
const OT_WEEKLY_MINUTES = 40 * 60;
const OT_MULTIPLIER = 1.5;

type PunchRow = {
  id: string;
  organizationId: string;
  siteId: string | null;
  userId: string;
  kind: string;
  punchedAt: Date;
  note: string | null;
  user: { id: string; name: string };
  site: { id: string; name: string; timezone: string } | null;
};

@Injectable()
export class TimeclockService {
  constructor(private readonly prisma: PrismaService) {}

  async status(user: SessionUser, siteId?: string | null): Promise<TimeClockStatus> {
    const timezone = await this.timezoneFor(user, siteId);
    const today = calendarDateInTimeZone(new Date(), timezone);
    const punches = await this.punchesForUser(user, today, today, timezone);
    const state = openState(punches);
    const open = openPunch(punches);
    const { workedMinutes, lunchMinutes } = minutesFromPunches(punches, new Date(), timezone);
    return {
      state,
      allowed: allowedKinds(state),
      openSince: open?.punchedAt.toISOString() ?? null,
      siteId: open?.siteId ?? null,
      siteName: open?.site?.name ?? null,
      todayPunches: punches.map((row) => this.toPunch(row)),
      workedMinutesToday: workedMinutes,
      lunchMinutesToday: lunchMinutes,
    };
  }

  async punch(user: SessionUser, input: TimePunchInput): Promise<TimeClockStatus> {
    const siteId = input.siteId ?? null;
    let site: { id: string; name: string; timezone: string; organizationId: string } | null = null;
    if (siteId) {
      site = await this.prisma.site.findUnique({ where: { id: siteId } });
      assertSiteAccess(user, site);
    }
    const timezone = site?.timezone ?? (await this.defaultTimezone(user));
    const today = calendarDateInTimeZone(new Date(), timezone);
    const punches = await this.punchesForUser(user, today, today, timezone);
    const state = openState(punches);
    if (!allowedKinds(state).includes(input.kind)) {
      throw new BadRequestException(punchError(state, input.kind));
    }
    await this.prisma.timePunch.create({
      data: {
        organizationId: user.organizationId,
        siteId: site?.id ?? null,
        userId: user.id,
        kind: input.kind,
        punchedAt: new Date(),
        note: input.note?.trim() ? input.note.trim() : null,
      },
    });
    return this.status(user, site?.id ?? siteId);
  }

  async presence(user: SessionUser, siteId?: string | null): Promise<TimePresenceList> {
    const timezone = await this.timezoneFor(user, siteId);
    const today = calendarDateInTimeZone(new Date(), timezone);
    const start = startOfDayUtc(today, timezone);
    const end = endOfDayUtc(today, timezone);
    const punches = await this.prisma.timePunch.findMany({
      where: {
        organizationId: user.organizationId,
        punchedAt: { gte: start, lte: end },
        ...(siteId ? { siteId } : {}),
        ...(!user.isOrgAdmin
          ? {
              OR: [{ userId: user.id }, { siteId: { in: user.siteIds } }, { siteId: null, userId: user.id }],
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, timezone: true } },
      },
      orderBy: [{ punchedAt: 'asc' }],
    });
    const byUser = new Map<string, PunchRow[]>();
    for (const row of punches as PunchRow[]) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }
    const people = [...byUser.entries()]
      .map(([userId, rows]) => {
        const state = openState(rows);
        if (state === 'out') {
          return null;
        }
        const open = openPunch(rows)!;
        return {
          userId,
          userName: open.user.name,
          state: state === 'lunch' ? ('lunch' as const) : ('in' as const),
          since: open.punchedAt.toISOString(),
          siteId: open.siteId,
          siteName: open.site?.name ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((left, right) => left.userName.localeCompare(right.userName));
    return { people };
  }

  async timecard(
    user: SessionUser,
    periodStart: string,
    periodEnd: string,
    targetUserId?: string | null,
    siteId?: string | null,
  ): Promise<TimePunch[]> {
    const subjectId = targetUserId && targetUserId !== user.id ? targetUserId : user.id;
    if (subjectId !== user.id && !user.isOrgAdmin && !user.permissions.includes('timeclock.manage')) {
      throw new ForbiddenException('You do not have permission for timeclock.manage.');
    }
    const subject = await this.prisma.user.findUnique({ where: { id: subjectId } });
    if (!subject || subject.organizationId !== user.organizationId) {
      throw new NotFoundException('Employee not found');
    }
    const timezone = await this.timezoneFor(user, siteId);
    const punches = await this.punchesForUser(
      { id: subject.id, organizationId: user.organizationId } as SessionUser,
      periodStart,
      periodEnd,
      timezone,
      siteId,
    );
    return punches.map((row) => this.toPunch(row));
  }

  async listRates(user: SessionUser): Promise<LaborRateView[]> {
    const [rates, people] = await Promise.all([
      this.prisma.laborRate.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { personName: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
      }),
    ]);
    const byName = new Map(people.map((person) => [person.name, person.id]));
    return rates.map((rate) => ({
      id: rate.id,
      personName: rate.personName,
      userId: byName.get(rate.personName) ?? null,
      hourlyCents: rate.hourlyCents,
    }));
  }

  async saveRate(user: SessionUser, input: LaborRateInput): Promise<LaborRateView> {
    if (!user.isOrgAdmin && !user.permissions.includes('timeclock.manage')) {
      throw new ForbiddenException('You do not have permission for timeclock.manage.');
    }
    const rate = await this.prisma.laborRate.upsert({
      where: {
        organizationId_personName: {
          organizationId: user.organizationId,
          personName: input.personName,
        },
      },
      create: {
        organizationId: user.organizationId,
        personName: input.personName,
        hourlyCents: input.hourlyCents,
      },
      update: { hourlyCents: input.hourlyCents },
    });
    const person = await this.prisma.user.findFirst({
      where: { organizationId: user.organizationId, name: rate.personName },
      select: { id: true },
    });
    return {
      id: rate.id,
      personName: rate.personName,
      userId: person?.id ?? null,
      hourlyCents: rate.hourlyCents,
    };
  }

  async payroll(
    user: SessionUser,
    periodStart: string,
    periodEnd: string,
    siteId?: string | null,
  ): Promise<PayrollReport> {
    if (!user.isOrgAdmin && !user.permissions.includes('timeclock.manage')) {
      throw new ForbiddenException('You do not have permission for timeclock.manage.');
    }
    assertDateOrder(periodStart, periodEnd);
    const timezone = await this.timezoneFor(user, siteId);
    let siteName: string | null = null;
    if (siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      assertSiteAccess(user, site);
      siteName = site.name;
    }
    const start = startOfDayUtc(periodStart, timezone);
    const end = endOfDayUtc(periodEnd, timezone);
    const [punches, rates, people] = await Promise.all([
      this.prisma.timePunch.findMany({
        where: {
          organizationId: user.organizationId,
          punchedAt: { gte: start, lte: end },
          ...(siteId ? { siteId } : {}),
        },
        include: {
          user: { select: { id: true, name: true } },
          site: { select: { id: true, name: true, timezone: true } },
        },
        orderBy: [{ punchedAt: 'asc' }],
      }),
      this.prisma.laborRate.findMany({ where: { organizationId: user.organizationId } }),
      this.prisma.user.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const rateByName = new Map(rates.map((rate) => [rate.personName, rate.hourlyCents]));
    const byUser = new Map<string, PunchRow[]>();
    for (const row of punches as PunchRow[]) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }
    const employees: PayrollEmployee[] = [];
    for (const person of people) {
      const rows = byUser.get(person.id) ?? [];
      if (rows.length === 0) {
        continue;
      }
      employees.push(buildEmployeePayroll(person, rows, rateByName.get(person.name) ?? null, timezone));
    }
    const totals = {
      employees: employees.length,
      workedMinutes: sum(employees.map((row) => row.workedMinutes)),
      lunchMinutes: sum(employees.map((row) => row.lunchMinutes)),
      regularMinutes: sum(employees.map((row) => row.regularMinutes)),
      overtimeMinutes: sum(employees.map((row) => row.overtimeMinutes)),
      regularCents: sum(employees.map((row) => row.regularCents)),
      overtimeCents: sum(employees.map((row) => row.overtimeCents)),
      grossCents: sum(employees.map((row) => row.grossCents)),
      missingRates: employees.filter((row) => row.hourlyCents == null).length,
    };
    const rateViews = rates
      .map((rate) => ({
        id: rate.id,
        personName: rate.personName,
        userId: people.find((person) => person.name === rate.personName)?.id ?? null,
        hourlyCents: rate.hourlyCents,
      }))
      .sort((left, right) => left.personName.localeCompare(right.personName));
    return {
      organizationId: user.organizationId,
      siteId: siteId ?? null,
      siteName,
      timezone,
      periodStart,
      periodEnd,
      statement: buildPayrollStatement(periodStart, periodEnd, siteName, totals, employees),
      accountingNotes: [
        'Lunch punches are unpaid break time and are excluded from worked hours.',
        'Overtime uses California-style rules for this facility timezone: over 8 hours in a day, then over 40 regular hours in a week, at 1.5× the stored hourly rate.',
        'Gross pay is regular hours × rate plus overtime hours × 1.5 × rate from Labor rates. Serenity does not file taxes, withholdings, or send ACH/payroll deposits.',
        'Open shifts still clocked in are counted through the moment the report runs.',
      ],
      totals,
      employees,
      rates: rateViews,
    };
  }

  async askPayroll(user: SessionUser, body: PayrollAsk): Promise<PayrollAnswer> {
    const report = await this.payroll(user, body.periodStart, body.periodEnd, body.siteId);
    return {
      reply: answerPayrollQuestion(body.question, report),
      report,
    };
  }

  private async punchesForUser(
    user: Pick<SessionUser, 'id' | 'organizationId'>,
    periodStart: string,
    periodEnd: string,
    timezone: string,
    siteId?: string | null,
  ): Promise<PunchRow[]> {
    assertDateOrder(periodStart, periodEnd);
    const rows = await this.prisma.timePunch.findMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        punchedAt: { gte: startOfDayUtc(periodStart, timezone), lte: endOfDayUtc(periodEnd, timezone) },
        ...(siteId ? { siteId } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        site: { select: { id: true, name: true, timezone: true } },
      },
      orderBy: [{ punchedAt: 'asc' }],
    });
    return rows as PunchRow[];
  }

  private toPunch(row: PunchRow): TimePunch {
    return {
      id: row.id,
      userId: row.userId,
      userName: row.user.name,
      siteId: row.siteId,
      siteName: row.site?.name ?? null,
      kind: row.kind as TimePunchKind,
      punchedAt: row.punchedAt.toISOString(),
      note: row.note,
    };
  }

  private async timezoneFor(user: SessionUser, siteId?: string | null): Promise<string> {
    if (siteId) {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      assertSiteAccess(user, site);
      return site.timezone;
    }
    return this.defaultTimezone(user);
  }

  private async defaultTimezone(user: SessionUser): Promise<string> {
    const site = await this.prisma.site.findFirst({
      where: user.isOrgAdmin
        ? { organizationId: user.organizationId }
        : { organizationId: user.organizationId, id: { in: user.siteIds } },
      orderBy: { name: 'asc' },
    });
    return site?.timezone ?? 'America/Los_Angeles';
  }
}

function allowedKinds(state: TimeClockStatus['state']): TimePunchKind[] {
  if (state === 'out') {
    return ['clock_in'];
  }
  if (state === 'in') {
    return ['lunch_start', 'clock_out'];
  }
  return ['lunch_end'];
}

function punchError(state: TimeClockStatus['state'], kind: TimePunchKind): string {
  if (state === 'out') {
    return 'Clock in before lunch or clock out.';
  }
  if (state === 'lunch') {
    return 'End lunch before clocking out or starting another lunch.';
  }
  if (kind === 'clock_in') {
    return 'Already clocked in. Use lunch or clock out.';
  }
  return 'That punch is not available right now.';
}

function openState(punches: Array<{ kind: string }>): TimeClockStatus['state'] {
  let state: TimeClockStatus['state'] = 'out';
  for (const punch of punches) {
    if (punch.kind === 'clock_in') {
      state = 'in';
    } else if (punch.kind === 'lunch_start') {
      state = 'lunch';
    } else if (punch.kind === 'lunch_end') {
      state = 'in';
    } else if (punch.kind === 'clock_out') {
      state = 'out';
    }
  }
  return state;
}

function openPunch(punches: PunchRow[]): PunchRow | null {
  let open: PunchRow | null = null;
  for (const punch of punches) {
    if (punch.kind === 'clock_in' || punch.kind === 'lunch_start' || punch.kind === 'lunch_end') {
      open = punch;
    } else if (punch.kind === 'clock_out') {
      open = null;
    }
  }
  return open;
}

function minutesFromPunches(
  punches: Array<{ kind: string; punchedAt: Date }>,
  now: Date,
  timezone: string,
): { workedMinutes: number; lunchMinutes: number } {
  let workedMs = 0;
  let lunchMs = 0;
  let workStarted: Date | null = null;
  let lunchStarted: Date | null = null;
  for (const punch of punches) {
    if (punch.kind === 'clock_in') {
      workStarted = punch.punchedAt;
    } else if (punch.kind === 'lunch_start' && workStarted) {
      workedMs += punch.punchedAt.getTime() - workStarted.getTime();
      workStarted = null;
      lunchStarted = punch.punchedAt;
    } else if (punch.kind === 'lunch_end' && lunchStarted) {
      lunchMs += punch.punchedAt.getTime() - lunchStarted.getTime();
      lunchStarted = null;
      workStarted = punch.punchedAt;
    } else if (punch.kind === 'clock_out') {
      if (lunchStarted) {
        lunchMs += punch.punchedAt.getTime() - lunchStarted.getTime();
        lunchStarted = null;
      }
      if (workStarted) {
        workedMs += punch.punchedAt.getTime() - workStarted.getTime();
        workStarted = null;
      }
    }
  }
  if (lunchStarted) {
    lunchMs += now.getTime() - lunchStarted.getTime();
  }
  if (workStarted) {
    workedMs += now.getTime() - workStarted.getTime();
  }
  void timezone;
  return {
    workedMinutes: Math.max(0, Math.round(workedMs / 60_000)),
    lunchMinutes: Math.max(0, Math.round(lunchMs / 60_000)),
  };
}

function buildEmployeePayroll(
  person: { id: string; name: string },
  punches: PunchRow[],
  hourlyCents: number | null,
  timezone: string,
): PayrollEmployee {
  const byDay = new Map<string, PunchRow[]>();
  for (const punch of punches) {
    const day = calendarDateInTimeZone(punch.punchedAt, timezone);
    const list = byDay.get(day) ?? [];
    list.push(punch);
    byDay.set(day, list);
  }
  const days = [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => {
      const { workedMinutes, lunchMinutes } = minutesFromPunches(rows, new Date(), timezone);
      const regularMinutes = Math.min(workedMinutes, OT_DAILY_MINUTES);
      const overtimeMinutes = Math.max(0, workedMinutes - OT_DAILY_MINUTES);
      return { date, workedMinutes, lunchMinutes, regularMinutes, overtimeMinutes };
    });

  // Weekly OT: any regular minutes over 40 in a calendar week become OT.
  const weekRegular = new Map<string, number>();
  for (const day of days) {
    const weekKey = weekStartKey(day.date);
    const used = weekRegular.get(weekKey) ?? 0;
    const room = Math.max(0, OT_WEEKLY_MINUTES - used);
    const keepRegular = Math.min(day.regularMinutes, room);
    const toOt = day.regularMinutes - keepRegular;
    day.regularMinutes = keepRegular;
    day.overtimeMinutes += toOt;
    weekRegular.set(weekKey, used + keepRegular);
  }

  const workedMinutes = sum(days.map((day) => day.workedMinutes));
  const lunchMinutes = sum(days.map((day) => day.lunchMinutes));
  const regularMinutes = sum(days.map((day) => day.regularMinutes));
  const overtimeMinutes = sum(days.map((day) => day.overtimeMinutes));
  const rate = hourlyCents ?? 0;
  const regularCents = Math.round((regularMinutes / 60) * rate);
  const overtimeCents = Math.round((overtimeMinutes / 60) * rate * OT_MULTIPLIER);
  return {
    userId: person.id,
    userName: person.name,
    hourlyCents,
    workedMinutes,
    lunchMinutes,
    regularMinutes,
    overtimeMinutes,
    regularCents: hourlyCents == null ? 0 : regularCents,
    overtimeCents: hourlyCents == null ? 0 : overtimeCents,
    grossCents: hourlyCents == null ? 0 : regularCents + overtimeCents,
    days,
    openShift: openState(punches) !== 'out',
  };
}

function buildPayrollStatement(
  periodStart: string,
  periodEnd: string,
  siteName: string | null,
  totals: PayrollReport['totals'],
  employees: PayrollEmployee[],
): string {
  const scope = siteName ? `${siteName}` : 'all facilities';
  const top = [...employees].sort((left, right) => right.grossCents - left.grossCents)[0];
  const missing =
    totals.missingRates > 0
      ? ` ${totals.missingRates} employee${totals.missingRates === 1 ? '' : 's'} still need a labor rate before gross pay is complete.`
      : '';
  return (
    `AI payroll for ${periodStart} through ${periodEnd} (${scope}): ` +
    `${totals.employees} employee${totals.employees === 1 ? '' : 's'}, ` +
    `${formatHours(totals.regularMinutes)} regular hours, ` +
    `${formatHours(totals.overtimeMinutes)} overtime hours, ` +
    `${formatHours(totals.lunchMinutes)} unpaid lunch, ` +
    `gross ${formatMoney(totals.grossCents)}.` +
    (top ? ` Highest gross: ${top.userName} at ${formatMoney(top.grossCents)}.` : '') +
    missing +
    ' Serenity calculates from stored punches and rates; it does not file taxes or run bank payroll.'
  );
}

function answerPayrollQuestion(question: string, report: PayrollReport): string {
  const text = question.toLowerCase();
  const withVoice = (reply: string) =>
    /^i['’]?m serenity\b/i.test(reply.trim()) ? reply : `I'm Serenity. ${reply}`;
  if (/overtime|ot\b/.test(text)) {
    const leaders = [...report.employees]
      .filter((row) => row.overtimeMinutes > 0)
      .sort((left, right) => right.overtimeMinutes - left.overtimeMinutes)
      .slice(0, 5)
      .map((row) => `${row.userName} ${formatHours(row.overtimeMinutes)}h OT (${formatMoney(row.overtimeCents)})`);
    return withVoice(
      `Overtime for ${report.periodStart}–${report.periodEnd}: ` +
        `${formatHours(report.totals.overtimeMinutes)} hours costing ${formatMoney(report.totals.overtimeCents)} at 1.5×. ` +
        (leaders.length ? `Leaders: ${leaders.join('; ')}.` : 'Nobody has overtime in this period.') +
        ` ${report.statement}`,
    );
  }
  if (/lunch|break/.test(text)) {
    return withVoice(
      `Unpaid lunch across the period is ${formatHours(report.totals.lunchMinutes)} hours. ` +
        `Worked time excludes lunch punches. ${report.statement}`,
    );
  }
  if (/rate|wage|hour/.test(text) && /miss|missing|without|no /.test(text)) {
    const missing = report.employees.filter((row) => row.hourlyCents == null).map((row) => row.userName);
    return withVoice(
      missing.length
        ? `Missing labor rates for: ${missing.join(', ')}. Set rates on Time clock → Pay rates. ${report.statement}`
        : `Every employee on this payroll has a stored labor rate. ${report.statement}`,
    );
  }
  if (/who|highest|most|top/.test(text)) {
    const top = [...report.employees].sort((left, right) => right.grossCents - left.grossCents).slice(0, 5);
    return withVoice(
      `Top gross pay: ` +
        top.map((row) => `${row.userName} ${formatMoney(row.grossCents)} (${formatHours(row.workedMinutes)}h)`).join('; ') +
        `. ${report.statement}`,
    );
  }
  if (/gross|total|pay|payroll|accounting|cost/.test(text)) {
    return withVoice(report.statement);
  }
  return withVoice(
    `${report.statement} Ask about overtime, lunch, missing rates, or top earners for a tighter breakdown.`,
  );
}

function assertDateOrder(periodStart: string, periodEnd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
    throw new BadRequestException('Use YYYY-MM-DD dates for the pay period.');
  }
  if (periodStart > periodEnd) {
    throw new BadRequestException('Pay period start must be on or before the end date.');
  }
}

function startOfDayUtc(dateKey: string, timeZone: string): Date {
  return zonedDateTimeToUtc(dateKey, '00:00', timeZone);
}

function endOfDayUtc(dateKey: string, timeZone: string): Date {
  return new Date(zonedDateTimeToUtc(dateKey, '23:59', timeZone).getTime() + 59_999);
}

function weekStartKey(dateKey: string): string {
  const date = dbDateFromKey(dateKey);
  const day = date.getUTCDay(); // 0 Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getTime() + mondayOffset * 86_400_000);
  return dateKeyFromDbDate(monday);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
