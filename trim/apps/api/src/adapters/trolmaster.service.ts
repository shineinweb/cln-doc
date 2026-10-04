import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionUser, TrolmasterChart, TrolmasterConnection, TrolmasterInput, TrolmasterMode, TrolmasterRange } from '@trim/contracts';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';
import { fetchTrolmasterHistory, parseTrolmasterHistory, trolmasterDeviceMessage, type TrolmasterMetric } from './trolmaster-client';

@Injectable()
export class TrolmasterService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: SessionUser, siteId: string): Promise<TrolmasterConnection[]> {
    await this.siteInScope(user, siteId);
    const rows = await this.prisma.trolmasterConnection.findMany({
      where: { siteId },
      include: { room: true },
      orderBy: { room: { name: 'asc' } },
    });
    return rows.map((row) => this.toView(row));
  }

  async save(user: SessionUser, siteId: string, input: TrolmasterInput): Promise<TrolmasterConnection> {
    await this.siteInScope(user, siteId);
    const room = await this.prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room || room.siteId !== siteId) {
      throw new BadRequestException('That room is not on this facility.');
    }
    const row = await this.prisma.trolmasterConnection.upsert({
      where: { roomId: room.id },
      create: {
        siteId,
        roomId: room.id,
        controllerId: input.controllerId,
        apiCredential: input.apiCredential,
      },
      update: {
        controllerId: input.controllerId,
        apiCredential: input.apiCredential,
      },
      include: { room: true },
    });
    return this.toView(row);
  }

  async setMode(user: SessionUser, roomId: string, input: TrolmasterMode): Promise<TrolmasterMode> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { site: true } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const enabled = input.enabled;
    const testMode = enabled && input.testMode;
    await this.prisma.room.update({
      where: { id: room.id },
      data: { trolmasterEnabled: enabled, trolmasterTest: testMode },
    });
    return { enabled, testMode };
  }

  async chart(user: SessionUser, roomId: string, range: TrolmasterRange = 'day'): Promise<TrolmasterChart> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { site: true, trolmasterConnection: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const connection = room.trolmasterConnection;
    if (!room.trolmasterEnabled) {
      return blankChart(connection?.controllerId ?? null, false, false, 'Trolmaster is off.');
    }
    if (room.trolmasterTest) {
      return blankChart(connection?.controllerId ?? 'Sample', true, true, 'Sample readings. Serenity is not calling Trolmaster.');
    }
    if (!connection) {
      return blankChart(null, true, false, 'Save a Trolmaster controller on Trolmaster settings.');
    }
    const end = new Date();
    const hours = range === 'month' ? 24 * 30 : range === 'week' ? 24 * 7 : 24;
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    try {
      const payload = await fetchTrolmasterHistory({
        apiKey: connection.apiCredential,
        controllerId: connection.controllerId,
        start: start.toISOString(),
        end: end.toISOString(),
      });
      const series = parseTrolmasterHistory(payload).map((item, index) => ({
        id: `${item.metric}-${index}`,
        name: item.name,
        metric: item.metric,
        unit: item.unit,
        points: item.points,
      }));
      return {
        controllerId: connection.controllerId,
        connected: true,
        enabled: true,
        testMode: false,
        message: series.length > 0 ? null : (trolmasterDeviceMessage(connection.controllerId, payload) ?? 'Trolmaster returned no chart points.'),
        latest: latestReadings(series),
        series,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Trolmaster did not return a chart.';
      return blankChart(connection.controllerId, true, false, message, true);
    }
  }

  private async siteInScope(user: SessionUser, siteId: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    return site;
  }

  private toView(row: { id: string; roomId: string; controllerId: string; room: { name: string } }): TrolmasterConnection {
    return {
      id: row.id,
      roomId: row.roomId,
      roomName: row.room.name,
      controllerId: row.controllerId,
      credentialSaved: true,
    };
  }
}

function blankChart(
  controllerId: string | null,
  enabled: boolean,
  testMode: boolean,
  message: string,
  connected = false,
): TrolmasterChart {
  return { controllerId, connected, enabled, testMode, message, latest: [], series: [] };
}

function latestReadings(
  series: TrolmasterChart['series'],
): TrolmasterChart['latest'] {
  return (['temp', 'humid', 'co2', 'vpd', 'light', 'ec', 'vwc'] as const).flatMap((metric) => {
    const match = series.find((item) => item.metric === metric && /pw/i.test(item.name)) ?? series.find((item) => item.metric === metric);
    const point = match?.points.at(-1);
    if (!match || !point) {
      return [];
    }
    return [{ metric: metric as TrolmasterMetric, label: headline(metric, match.name), value: point.value, unit: match.unit }];
  });
}

function headline(metric: TrolmasterMetric, name: string): string {
  const labels: Partial<Record<TrolmasterMetric, string>> = {
    temp: 'Temp',
    humid: 'Humid',
    co2: 'CO2',
    vpd: 'VPD',
    light: 'Light',
    vwc: 'VWC',
  };
  if (metric === 'ec') {
    return /pw/i.test(name) ? 'EC PW' : 'EC';
  }
  return labels[metric] ?? name;
}
