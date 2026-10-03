import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AlertRule,
  CreateAlertRule,
  CreateReading,
  EnvironmentalReading,
  ImportReadingsResult,
  LatestReadingSlot,
  RoomAlert,
  SessionUser,
} from '@trim/contracts';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { parseRecordedAt } from './wall-time';

const METRICS = ['temperature', 'relative_humidity', 'co2', 'substrate'] as const;
type Metric = (typeof METRICS)[number];

const METRIC_LABEL: Record<Metric, string> = {
  temperature: 'Temperature',
  relative_humidity: 'Relative humidity',
  co2: 'CO₂',
  substrate: 'Substrate',
};

const QUALITIES = new Set(['good', 'suspect', 'bad']);

const CSV_COLUMNS = ['device_id', 'metric', 'value', 'unit', 'recorded_at', 'quality', 'sample'] as const;

type ReadingRow = {
  id: string;
  recordedAt: Date;
  metric: string;
  value: { toString(): string };
  unit: string;
  deviceId: string;
  quality: string;
  isSample: boolean;
};

type RuleRow = {
  id: string;
  metric: string;
  kind: string;
  minValue: { toString(): string } | null;
  maxValue: { toString(): string } | null;
  enabled: boolean;
};

@Injectable()
export class EnvironmentService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(roomId: string): Promise<{
    staleAfterMinutes: number;
    activeAlerts: RoomAlert[];
    latestReadings: LatestReadingSlot[];
    readingHistory: EnvironmentalReading[];
  }> {
    await this.evaluate(roomId);
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      include: {
        readings: { orderBy: { recordedAt: 'asc' } },
        alerts: { where: { active: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    const newest = new Map<string, ReadingRow>();
    for (const reading of room.readings) {
      const current = newest.get(reading.metric);
      if (!current || reading.recordedAt > current.recordedAt) {
        newest.set(reading.metric, reading);
      }
    }
    const now = new Date();
    return {
      staleAfterMinutes: room.staleAfterMinutes,
      activeAlerts: room.alerts.map((alert) => ({
        id: alert.id,
        message: alert.message,
        metric: alert.metric,
        kind: alert.kind,
      })),
      latestReadings: METRICS.map((metric) => this.toSlot(metric, newest.get(metric) ?? null, room.staleAfterMinutes, now)),
      readingHistory: room.readings.map((reading) => this.toReading(reading)),
    };
  }

  async createReading(user: SessionUser, roomId: string, body: CreateReading): Promise<EnvironmentalReading> {
    const room = await this.roomInScope(user, roomId);
    const recordedAt = this.timestamp(body.recordedAt, room.site.timezone);
    const reading = await this.prisma.environmentalReading.create({
      data: {
        roomId,
        deviceId: body.deviceId,
        metric: body.metric,
        value: body.value,
        unit: body.unit,
        recordedAt,
        quality: body.quality,
        isSample: body.isSample,
      },
    });
    await this.evaluate(roomId);
    return this.toReading(reading);
  }

  async importCsv(user: SessionUser, roomId: string, csv: string): Promise<ImportReadingsResult> {
    const room = await this.roomInScope(user, roomId);
    const rows = parseCsv(csv);
    const header = rows[0];
    if (!header) {
      throw new BadRequestException('The CSV needs a header row.');
    }
    const columns = new Map(header.map((name, index) => [name.toLowerCase(), index]));
    for (const column of CSV_COLUMNS) {
      if (!columns.has(column)) {
        throw new BadRequestException(
          'The CSV needs columns device_id, metric, value, unit, recorded_at, quality, and sample.',
        );
      }
    }
    const dataRows = rows.slice(1);
    if (dataRows.length === 0) {
      throw new BadRequestException('The CSV has no readings.');
    }
    const created: ReadingRow[] = [];
    for (const [offset, row] of dataRows.entries()) {
      const line = offset + 2;
      const cell = (column: (typeof CSV_COLUMNS)[number]) => row[columns.get(column) ?? -1]?.trim() ?? '';
      const metric = cell('metric');
      if (!isMetric(metric)) {
        throw new BadRequestException(`Row ${line}: metric must be temperature, relative_humidity, co2, or substrate.`);
      }
      const value = Number(cell('value'));
      if (!Number.isFinite(value)) {
        throw new BadRequestException(`Row ${line}: value must be a number.`);
      }
      const quality = cell('quality').toLowerCase();
      if (!QUALITIES.has(quality)) {
        throw new BadRequestException(`Row ${line}: quality must be good, suspect, or bad.`);
      }
      const deviceId = cell('device_id');
      const unit = cell('unit');
      if (!deviceId || !unit) {
        throw new BadRequestException(`Row ${line}: device_id and unit are required.`);
      }
      let recordedAt: Date;
      try {
        recordedAt = parseRecordedAt(cell('recorded_at'), room.site.timezone);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'That timestamp is not valid.';
        throw new BadRequestException(`Row ${line}: ${message}`);
      }
      created.push(
        await this.prisma.environmentalReading.create({
          data: {
            roomId,
            deviceId,
            metric,
            value,
            unit,
            recordedAt,
            quality,
            isSample: parseSample(cell('sample')),
          },
        }),
      );
    }
    await this.evaluate(roomId);
    return { imported: created.length, readings: created.map((reading) => this.toReading(reading)) };
  }

  async createRule(user: SessionUser, roomId: string, body: CreateAlertRule): Promise<AlertRule> {
    await this.roomInScope(user, roomId);
    const rule = await this.prisma.alertRule.create({
      data: {
        roomId,
        metric: body.metric,
        kind: body.kind,
        minValue: body.kind === 'range' ? (body.minValue ?? null) : null,
        maxValue: body.kind === 'range' ? (body.maxValue ?? null) : null,
        enabled: true,
      },
    });
    await this.evaluate(roomId);
    return this.toRule(rule);
  }

  async getReading(user: SessionUser, readingId: string): Promise<EnvironmentalReading> {
    const reading = await this.prisma.environmentalReading.findUnique({
      where: { id: readingId },
      include: { room: { include: { site: true } } },
    });
    if (!reading || reading.room.site.organizationId !== user.organizationId) {
      throw new NotFoundException('Reading not found');
    }
    if (!user.isOrgAdmin && !user.siteIds.includes(reading.room.site.id)) {
      throw new ForbiddenException('You do not have access to this reading.');
    }
    return this.toReading(reading);
  }

  async evaluate(roomId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        alertRules: { where: { enabled: true } },
        readings: { orderBy: { recordedAt: 'desc' } },
      },
    });
    if (!room) {
      return;
    }
    const newest = new Map<string, ReadingRow>();
    const newestLive = new Map<string, ReadingRow>();
    for (const reading of room.readings) {
      if (!newest.has(reading.metric)) {
        newest.set(reading.metric, reading);
      }
      if (!reading.isSample && !newestLive.has(reading.metric)) {
        newestLive.set(reading.metric, reading);
      }
    }
    const now = new Date();
    for (const rule of room.alertRules) {
      const outcome = this.ruleOutcome(rule, newest.get(rule.metric) ?? null, newestLive.get(rule.metric) ?? null, room.staleAfterMinutes, now);
      await this.upsertAlert(roomId, rule, outcome.active, outcome.message);
    }
  }

  private ruleOutcome(
    rule: RuleRow,
    newest: ReadingRow | null,
    newestLive: ReadingRow | null,
    staleAfterMinutes: number,
    now: Date,
  ): { active: boolean; message: string } {
    const label = metricLabel(rule.metric);
    if (rule.kind === 'stale') {
      const active = isStale(newest?.recordedAt ?? null, staleAfterMinutes, now);
      return {
        active,
        message: `${label} is stale. No reading is newer than ${staleAfterMinutes} minutes.`,
      };
    }
    if (!newestLive) {
      return { active: false, message: '' };
    }
    const value = Number(newestLive.value);
    const min = rule.minValue == null ? null : Number(rule.minValue);
    const max = rule.maxValue == null ? null : Number(rule.maxValue);
    const below = min != null && value < min;
    const above = max != null && value > max;
    if (!below && !above) {
      return { active: false, message: '' };
    }
    const bounds =
      min != null && max != null ? `${min}–${max}` : min != null ? `the minimum ${min}` : `the maximum ${max}`;
    return {
      active: true,
      message: `${label} is outside ${bounds} ${newestLive.unit}. The latest reading is ${value} ${newestLive.unit}.`,
    };
  }

  private async upsertAlert(roomId: string, rule: RuleRow, active: boolean, message: string): Promise<void> {
    const existing = await this.prisma.roomAlert.findFirst({ where: { ruleId: rule.id }, orderBy: { createdAt: 'desc' } });
    if (!existing) {
      if (!active) {
        return;
      }
      await this.prisma.roomAlert.create({
        data: {
          roomId,
          ruleId: rule.id,
          metric: rule.metric,
          kind: rule.kind,
          message,
          active: true,
        },
      });
      return;
    }
    await this.prisma.roomAlert.update({
      where: { id: existing.id },
      data: {
        metric: rule.metric,
        kind: rule.kind,
        active,
        message: active ? message : existing.message,
      },
    });
  }

  private async roomInScope(user: SessionUser, roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { site: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    return room;
  }

  private timestamp(input: string, timeZone: string): Date {
    try {
      return parseRecordedAt(input, timeZone);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That timestamp is not valid.';
      throw new BadRequestException(message);
    }
  }

  private toSlot(metric: Metric, reading: ReadingRow | null, staleAfterMinutes: number, now: Date): LatestReadingSlot {
    if (!reading) {
      return {
        metric,
        id: null,
        recordedAt: null,
        value: null,
        unit: null,
        deviceId: null,
        quality: null,
        isSample: false,
        stale: true,
      };
    }
    return {
      metric,
      id: reading.id,
      recordedAt: reading.recordedAt.toISOString(),
      value: Number(reading.value),
      unit: reading.unit,
      deviceId: reading.deviceId,
      quality: reading.quality,
      isSample: reading.isSample,
      stale: isStale(reading.recordedAt, staleAfterMinutes, now),
    };
  }

  private toReading(reading: ReadingRow): EnvironmentalReading {
    return {
      id: reading.id,
      recordedAt: reading.recordedAt.toISOString(),
      metric: reading.metric,
      value: Number(reading.value),
      unit: reading.unit,
      deviceId: reading.deviceId,
      quality: reading.quality,
      isSample: reading.isSample,
    };
  }

  private toRule(rule: RuleRow & { roomId: string }): AlertRule {
    return {
      id: rule.id,
      roomId: rule.roomId,
      metric: rule.metric,
      kind: rule.kind,
      minValue: rule.minValue == null ? null : Number(rule.minValue),
      maxValue: rule.maxValue == null ? null : Number(rule.maxValue),
      enabled: rule.enabled,
    };
  }
}

export function isStale(recordedAt: Date | null, staleAfterMinutes: number, now: Date): boolean {
  if (!recordedAt) {
    return true;
  }
  return now.getTime() - recordedAt.getTime() > staleAfterMinutes * 60_000;
}

function metricLabel(metric: string): string {
  return isMetric(metric) ? METRIC_LABEL[metric] : metric;
}

function isMetric(value: string): value is Metric {
  return (METRICS as readonly string[]).includes(value);
}

function parseSample(value: string): boolean {
  return ['true', 'yes', '1', 'sample'].includes(value.trim().toLowerCase());
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? '';
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell.trim());
      cell = '';
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }
  return rows;
}
