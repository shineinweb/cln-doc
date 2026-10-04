import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateRoom,
  CreateSite,
  Defoliation,
  DefoliationInput,
  FacilityBoard,
  FacilityBoardCell,
  FacilityBoardColumn,
  OrganizationSummary,
  RecordRemoved,
  Room,
  RoomDetail,
  SessionUser,
  Site,
  Zone,
  ZoneInput,
} from '@trim/contracts';
import { addCalendarDays, calendarDateInTimeZone, dateKeyFromDbDate } from '../cycles/cycle-day';
import { activeCycleInclude, CyclesService } from '../cycles/cycles.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomTasksService } from './room-tasks.service';
import { assertSiteAccess, authorizedSiteWhere } from './site-access';

const roomInclude = {
  zones: { orderBy: { name: 'asc' as const } },
  cycles: activeCycleInclude,
};

type RoomRecord = {
  id: string;
  siteId: string;
  name: string;
  code: string;
  roomType: string;
  createdAt: Date;
  updatedAt: Date;
  zones: Array<{
    id: string;
    roomId: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  cycles: Parameters<CyclesService['summary']>[0][];
};

@Injectable()
export class FacilitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cycles: CyclesService,
    private readonly roomTasks: RoomTasksService,
  ) {}

  async createSite(user: SessionUser, input: CreateSite): Promise<Site> {
    const existing = await this.prisma.site.findMany({
      where: { organizationId: user.organizationId },
      select: { code: true },
    });
    const code = uniqueRoomCode(input.name, existing.map((site) => site.code));
    try {
      const site = await this.prisma.site.create({
        data: {
          organizationId: user.organizationId,
          name: input.name,
          code,
          addressLine1: input.addressLine1,
          city: input.city,
          region: input.region,
          postalCode: input.postalCode,
          memberships: user.isOrgAdmin ? undefined : { create: { userId: user.id } },
        },
        include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
      });
      return this.toSite(site, site.timezone);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new BadRequestException('A facility with that name already exists.');
      }
      throw error;
    }
  }

  async updateSite(user: SessionUser, siteId: string, input: CreateSite): Promise<Site> {
    const existing = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, existing);
    const site = await this.prisma.site.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        addressLine1: input.addressLine1,
        city: input.city,
        region: input.region,
        postalCode: input.postalCode,
      },
      include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
    });
    return this.toSite(site, site.timezone);
  }

  async deleteSite(user: SessionUser, siteId: string): Promise<RecordRemoved> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    try {
      await this.prisma.site.delete({ where: { id: site.id } });
    } catch (error) {
      if (isForeignKeyConstraint(error)) {
        throw new BadRequestException('This facility still has records that cannot be removed.');
      }
      throw error;
    }
    return { id: site.id, removed: true, voided: false };
  }

  async listSites(user: SessionUser): Promise<Site[]> {
    const sites = await this.prisma.site.findMany({
      where: authorizedSiteWhere(user),
      include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return sites.map((site) => this.toSite(site, site.timezone));
  }

  async getSite(user: SessionUser, siteId: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
    });
    assertSiteAccess(user, site);
    return this.toSite(site, site.timezone);
  }

  async listRooms(user: SessionUser, siteId: string): Promise<Room[]> {
    const site = await this.getSite(user, siteId);
    return site.rooms;
  }

  async createRoom(user: SessionUser, siteId: string, input: CreateRoom): Promise<Room> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    const existing = await this.prisma.room.findMany({
      where: { siteId },
      select: { code: true },
    });
    const code = uniqueRoomCode(
      input.name,
      existing.map((room) => room.code),
    );
    try {
      const room = await this.prisma.room.create({
        data: {
          siteId,
          name: input.name,
          code,
          roomType: input.roomType,
        },
        include: roomInclude,
      });
      return this.toRoom(room, site.timezone);
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new BadRequestException('A room with that name already exists on this facility.');
      }
      throw error;
    }
  }

  async pageRooms(user: SessionUser, siteId: string, pageRaw: string, pageSizeRaw: string) {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    const window = pageWindow(pageRaw, pageSizeRaw);
    const where = { siteId };
    const [total, rooms] = await Promise.all([
      this.prisma.room.count({ where }),
      this.prisma.room.findMany({
        where,
        include: roomInclude,
        orderBy: { name: 'asc' },
        skip: window.skip,
        take: window.take,
      }),
    ]);
    return {
      items: rooms.map((room) => this.toRoom(room, site.timezone)),
      page: window.page,
      pageSize: window.pageSize,
      total,
    };
  }

  async updateRoom(user: SessionUser, siteId: string, roomId: string, input: CreateRoom): Promise<Room> {
    const room = await this.ownedRoom(user, siteId, roomId);
    const updated = await this.prisma.room.update({
      where: { id: room.id },
      data: { name: input.name, roomType: input.roomType },
      include: roomInclude,
    });
    return this.toRoom(updated, room.site.timezone);
  }

  async deleteRoom(user: SessionUser, siteId: string, roomId: string): Promise<RecordRemoved> {
    const room = await this.ownedRoom(user, siteId, roomId);
    await this.prisma.room.delete({ where: { id: room.id } });
    return { id: room.id, removed: true, voided: false };
  }

  async createZone(user: SessionUser, roomId: string, input: ZoneInput): Promise<Zone> {
    const room = await this.roomForChange(user, roomId);
    const existing = await this.prisma.zone.findMany({ where: { roomId: room.id }, select: { code: true } });
    const zone = await this.prisma.zone.create({
      data: {
        roomId: room.id,
        name: input.name,
        code: uniqueRoomCode(input.name, existing.map((row) => row.code)),
      },
    });
    return this.toZone(zone);
  }

  async updateZone(user: SessionUser, zoneId: string, input: ZoneInput): Promise<Zone> {
    const zone = await this.ownedZone(user, zoneId);
    const updated = await this.prisma.zone.update({ where: { id: zone.id }, data: { name: input.name } });
    return this.toZone(updated);
  }

  async deleteZone(user: SessionUser, zoneId: string): Promise<RecordRemoved> {
    const zone = await this.ownedZone(user, zoneId);
    await this.prisma.zone.delete({ where: { id: zone.id } });
    return { id: zone.id, removed: true, voided: false };
  }

  async getRoom(user: SessionUser, roomId: string): Promise<RoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { ...roomInclude, site: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    const current = room.cycles[0] ?? null;
    const signals = await this.cycles.roomSignals(room.id, room.site.id, room.site.timezone);
    const archived = await this.prisma.cropCycle.findMany({
      where: { roomId: room.id, status: 'archived' },
      orderBy: { startDate: 'desc' },
    });
    return {
      ...this.toRoom(room, room.site.timezone),
      siteName: room.site.name,
      siteCode: room.site.code,
      siteTimezone: room.site.timezone,
      operatingHistory: current ? this.cycles.history(current) : null,
      archivedCycles: archived.map((cycle) => ({
        id: cycle.id,
        name: cycle.name,
        cultivar: cycle.cultivar,
        stage: cycle.stage,
        startDate: dateKeyFromDbDate(cycle.startDate),
        expectedHarvestDate: dateKeyFromDbDate(cycle.expectedHarvestDate),
        harvestDate: cycle.harvestDate ? dateKeyFromDbDate(cycle.harvestDate) : null,
      })),
      ...signals,
      managedTasks: await this.roomTasks.list(room.id),
      defoliations: await this.defoliationViews(room.id, current?.startDate ?? null),
    };
  }

  async saveDefoliations(user: SessionUser, roomId: string, input: DefoliationInput): Promise<Defoliation[]> {
    const room = await this.roomForChange(user, roomId);
    if (room.roomType === 'dry') {
      throw new BadRequestException('A dry room does not use a defoliation schedule.');
    }
    const days = [...input.days].sort((left, right) => left - right);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException('Each defoliation day can be listed once.');
    }
    await this.prisma.$transaction([
      this.prisma.roomDefoliation.deleteMany({ where: { roomId: room.id } }),
      this.prisma.roomDefoliation.createMany({
        data: days.map((dayNumber) => ({ roomId: room.id, dayNumber })),
      }),
    ]);
    const current = await this.prisma.cropCycle.findFirst({
      where: { roomId: room.id, status: 'active' },
      orderBy: { startDate: 'desc' },
    });
    return this.defoliationViews(room.id, current?.startDate ?? null);
  }

  private async defoliationViews(roomId: string, startDate: Date | null): Promise<Defoliation[]> {
    const rows = await this.prisma.roomDefoliation.findMany({
      where: { roomId },
      orderBy: [{ dayNumber: 'asc' }, { createdAt: 'asc' }],
    });
    const startKey = startDate ? dateKeyFromDbDate(startDate) : null;
    return rows.map((row) => ({
      id: row.id,
      dayNumber: row.dayNumber,
      date: startKey ? addCalendarDays(startKey, row.dayNumber - 1) : null,
    }));
  }

  async getOrganization(user: SessionUser): Promise<OrganizationSummary> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    const siteCount = await this.prisma.site.count({ where: authorizedSiteWhere(user) });
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      siteCount,
    };
  }

  async facilityBoard(user: SessionUser, siteId: string): Promise<FacilityBoard> {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    assertSiteAccess(user, site);
    const today = calendarDateInTimeZone(new Date(), site.timezone);
    // Flower / veg / mother / clone rows only — dry rooms stay off the milestone board.
    const rooms = await this.prisma.room.findMany({
      where: { siteId: site.id, roomType: { not: 'dry' } },
      include: {
        defoliations: { orderBy: { dayNumber: 'asc' } },
        cycles: {
          where: { status: 'active' },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });
    const roomIds = rooms.map((room) => room.id);
    const [cycleTasks, roomTasks, duties] = await Promise.all([
      roomIds.length === 0
        ? Promise.resolve([])
        : this.prisma.cycleTask.findMany({
            where: { roomId: { in: roomIds } },
            orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
          }),
      roomIds.length === 0
        ? Promise.resolve([])
        : this.prisma.roomTask.findMany({
            where: { roomId: { in: roomIds } },
            orderBy: [{ dueOn: 'asc' }, { title: 'asc' }],
          }),
      this.prisma.recurringDuty.findMany({
        where: { siteId: site.id },
        orderBy: [{ nextDueOn: 'asc' }, { title: 'asc' }],
      }),
    ]);

    const defoliationDays = [
      ...new Set(rooms.flatMap((room) => room.defoliations.map((row) => row.dayNumber))),
    ].sort((left, right) => left - right);

    const columns: FacilityBoardColumn[] = [
      { key: 'start', label: '1st', kind: 'start', dayNumber: null },
      ...defoliationDays.map((dayNumber) => ({
        key: `defoliation-${dayNumber}`,
        label: `D${dayNumber}`,
        kind: 'defoliation' as const,
        dayNumber,
      })),
      ...BOARD_CHORE_COLUMNS,
    ];

    const cycleTasksByRoom = groupBy(cycleTasks, (task) => task.roomId);
    const roomTasksByRoom = groupBy(roomTasks, (task) => task.roomId);

    const rows = rooms.map((room) => {
      const cycle = room.cycles[0] ?? null;
      const startKey = cycle ? dateKeyFromDbDate(cycle.startDate) : null;
      const cells = columns.map((column) =>
        boardCellForColumn({
          column,
          today,
          startKey,
          cycle,
          defoliations: room.defoliations,
          roomType: room.roomType,
          cycleTasks: cycleTasksByRoom.get(room.id) ?? [],
          roomTasks: roomTasksByRoom.get(room.id) ?? [],
          duties: duties.filter((duty) => duty.roomId == null || duty.roomId === room.id),
        }),
      );
      return {
        roomId: room.id,
        roomName: room.name,
        roomType: room.roomType,
        cycleId: cycle?.id ?? null,
        cycleName: cycle?.name ?? null,
        cultivar: cycle?.cultivar ?? null,
        cells,
      };
    });

    return {
      siteId: site.id,
      siteName: site.name,
      timezone: site.timezone,
      today,
      statement:
        'Facility board: rooms across the top milestones — crop start, defoliation days, harvest, trim, and matching room chores or Operations duties.',
      columns,
      rows,
      notes: [
        'Anytime work happens in a flower room, check the drippers.',
        'Check fans, ACs, and dehumidifiers every Friday.',
        'Wash water filters every Tuesday and Friday.',
      ],
    };
  }

  private async ownedRoom(user: SessionUser, siteId: string, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { site: true } });
    if (!room || room.siteId !== siteId) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    return room;
  }

  private async roomForChange(user: SessionUser, roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, include: { site: true } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    return room;
  }

  private async ownedZone(user: SessionUser, zoneId: string) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId }, include: { room: { include: { site: true } } } });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    assertSiteAccess(user, zone.room.site);
    return zone;
  }

  private toSite(
    site: {
      id: string;
      organizationId: string;
      name: string;
      code: string;
      addressLine1: string | null;
      city: string | null;
      region: string | null;
      postalCode: string | null;
      timezone: string;
      createdAt: Date;
      updatedAt: Date;
      rooms: RoomRecord[];
    },
    timeZone: string,
  ): Site {
    return {
      id: site.id,
      organizationId: site.organizationId,
      name: site.name,
      code: site.code,
      addressLine1: site.addressLine1,
      city: site.city,
      region: site.region,
      postalCode: site.postalCode,
      timezone: site.timezone,
      createdAt: site.createdAt.toISOString(),
      updatedAt: site.updatedAt.toISOString(),
      rooms: site.rooms.map((room) => this.toRoom(room, timeZone)),
    };
  }

  private toRoom(room: RoomRecord, timeZone: string): Room {
    const current = room.cycles[0] ?? null;
    return {
      id: room.id,
      siteId: room.siteId,
      name: room.name,
      code: room.code,
      roomType: room.roomType,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      zones: room.zones.map((zone) => this.toZone(zone)),
      currentCycle: current ? this.cycles.summary(current, timeZone) : null,
    };
  }

  private toZone(zone: {
    id: string;
    roomId: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  }): Zone {
    return {
      id: zone.id,
      roomId: zone.roomId,
      name: zone.name,
      code: zone.code,
      createdAt: zone.createdAt.toISOString(),
      updatedAt: zone.updatedAt.toISOString(),
    };
  }
}

function pageWindow(pageRaw: string, pageSizeRaw: string) {
  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(pageSizeRaw, 10) || 5));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function uniqueRoomCode(name: string, takenCodes: string[]): string {
  const taken = new Set(takenCodes);
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12) || 'ROOM';
  let code = base;
  let suffix = 2;
  while (taken.has(code)) {
    const tail = String(suffix);
    code = `${base.slice(0, Math.max(1, 12 - tail.length))}${tail}`;
    suffix += 1;
  }
  return code;
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function isForeignKeyConstraint(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2003';
}

const BOARD_CHORE_COLUMNS: FacilityBoardColumn[] = [
  { key: 'sulfur', label: 'Sul.', kind: 'chore', dayNumber: null },
  { key: 'dripper', label: 'Dripper', kind: 'chore', dayNumber: null },
  { key: 'side_net', label: 'Side Net', kind: 'chore', dayNumber: null },
  { key: 'filters_ac', label: 'Filters AC', kind: 'chore', dayNumber: null },
  { key: 'ls', label: 'LS', kind: 'chore', dayNumber: null },
  { key: 'harvest', label: 'H', kind: 'harvest', dayNumber: null },
  { key: 'trim', label: 'T', kind: 'trim', dayNumber: null },
  { key: 'garden_clean', label: 'Garden Clean', kind: 'chore', dayNumber: null },
  { key: 'water_filters', label: 'Water Filters', kind: 'chore', dayNumber: null },
  { key: 'fans_ac', label: 'Fans / AC', kind: 'chore', dayNumber: null },
];

const BOARD_CHORE_MATCHERS: Record<string, RegExp> = {
  sulfur: /sulfur|sulphur|\bsul\.?\b/i,
  dripper: /drip/i,
  side_net: /side\s*net|trellis|netting/i,
  filters_ac: /filters?\s*ac|ac\s*filters?|hvac\s*filter/i,
  ls: /\bls\b|light\s*sched|late\s*stage|flip\s*to\s*flower/i,
  trim: /\btrim\b/i,
  garden_clean: /garden\s*clean|room\s*sanit|clean\s*(the\s*)?room|wipe\s*tables/i,
  water_filters: /water\s*fil+t/i,
  fans_ac: /\bfans?\b|odor|dehu|check\s*ac/i,
};

type BoardCycle = {
  id: string;
  name: string;
  cultivar: string;
  startDate: Date;
  expectedHarvestDate: Date;
  harvestDate: Date | null;
};

type BoardTask = {
  title: string;
  status: string;
  dueOn: Date | null;
};

type BoardDuty = {
  title: string;
  nextDueOn: Date;
  roomId: string | null;
};

function boardCellForColumn(input: {
  column: FacilityBoardColumn;
  today: string;
  startKey: string | null;
  cycle: BoardCycle | null;
  defoliations: Array<{ dayNumber: number }>;
  roomType: string;
  cycleTasks: BoardTask[];
  roomTasks: BoardTask[];
  duties: BoardDuty[];
}): FacilityBoardCell {
  const { column, today, startKey, cycle, defoliations, roomType } = input;

  if (column.kind === 'start') {
    if (!startKey) {
      return emptyCell(column.key);
    }
    return datedCell({
      columnKey: column.key,
      dates: [startKey],
      today,
      done: startKey <= today,
      detail: cycle?.name ?? null,
      source: 'cycle',
    });
  }

  if (column.kind === 'defoliation') {
    if (roomType === 'dry') {
      return emptyCell(column.key);
    }
    const dayNumber = column.dayNumber;
    if (dayNumber == null || !defoliations.some((row) => row.dayNumber === dayNumber)) {
      return emptyCell(column.key);
    }
    if (!startKey) {
      return {
        columnKey: column.key,
        dates: [],
        status: 'scheduled',
        detail: `Day ${dayNumber}`,
        source: 'defoliation',
      };
    }
    const date = addCalendarDays(startKey, dayNumber - 1);
    return datedCell({
      columnKey: column.key,
      dates: [date],
      today,
      done: date < today,
      detail: `Day ${dayNumber}`,
      source: 'defoliation',
    });
  }

  if (column.kind === 'harvest') {
    if (!cycle) {
      return emptyCell(column.key);
    }
    if (cycle.harvestDate) {
      const date = dateKeyFromDbDate(cycle.harvestDate);
      return {
        columnKey: column.key,
        dates: [date],
        status: 'done',
        detail: cycle.name,
        source: 'harvest',
      };
    }
    const expected = dateKeyFromDbDate(cycle.expectedHarvestDate);
    return datedCell({
      columnKey: column.key,
      dates: [expected],
      today,
      done: false,
      detail: cycle.name,
      source: 'harvest',
    });
  }

  const matcher = BOARD_CHORE_MATCHERS[column.key];
  if (!matcher) {
    return emptyCell(column.key);
  }

  const cycleMatch = input.cycleTasks.find((task) => matcher.test(task.title));
  if (cycleMatch) {
    const date = cycleMatch.dueOn ? dateKeyFromDbDate(cycleMatch.dueOn) : null;
    const done = cycleMatch.status !== 'open';
    if (!date) {
      return {
        columnKey: column.key,
        dates: [],
        status: done ? 'done' : 'scheduled',
        detail: cycleMatch.title,
        source: 'cycle_task',
      };
    }
    return datedCell({
      columnKey: column.key,
      dates: [date],
      today,
      done,
      detail: cycleMatch.title,
      source: 'cycle_task',
    });
  }

  const roomMatch = input.roomTasks.find((task) => matcher.test(task.title));
  if (roomMatch) {
    const date = roomMatch.dueOn ? dateKeyFromDbDate(roomMatch.dueOn) : null;
    const done = roomMatch.status !== 'open';
    if (!date) {
      return {
        columnKey: column.key,
        dates: [],
        status: done ? 'done' : 'scheduled',
        detail: roomMatch.title,
        source: 'room_task',
      };
    }
    return datedCell({
      columnKey: column.key,
      dates: [date],
      today,
      done,
      detail: roomMatch.title,
      source: 'room_task',
    });
  }

  const dutyMatch = input.duties.find((duty) => matcher.test(duty.title));
  if (dutyMatch) {
    const date = dateKeyFromDbDate(dutyMatch.nextDueOn);
    return datedCell({
      columnKey: column.key,
      dates: [date],
      today,
      done: false,
      detail: dutyMatch.title,
      source: 'duty',
    });
  }

  return emptyCell(column.key);
}

function emptyCell(columnKey: string): FacilityBoardCell {
  return {
    columnKey,
    dates: [],
    status: 'empty',
    detail: null,
    source: null,
  };
}

function datedCell(input: {
  columnKey: string;
  dates: string[];
  today: string;
  done: boolean;
  detail: string | null;
  source: FacilityBoardCell['source'];
}): FacilityBoardCell {
  if (input.done) {
    return {
      columnKey: input.columnKey,
      dates: input.dates,
      status: 'done',
      detail: input.detail,
      source: input.source,
    };
  }
  const first = input.dates[0];
  let status: FacilityBoardCell['status'] = 'scheduled';
  if (first === input.today) {
    status = 'due';
  } else if (first < input.today) {
    status = 'overdue';
  }
  return {
    columnKey: input.columnKey,
    dates: input.dates,
    status,
    detail: input.detail,
    source: input.source,
  };
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}
