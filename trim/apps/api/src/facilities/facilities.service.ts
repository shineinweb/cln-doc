import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateRoom, OrganizationSummary, Room, RoomDetail, SessionUser, Site, Zone } from '@trim/contracts';
import { activeCycleInclude, CyclesService } from '../cycles/cycles.service';
import { PrismaService } from '../prisma/prisma.service';
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
  ) {}

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
    return {
      ...this.toRoom(room, room.site.timezone),
      siteName: room.site.name,
      siteCode: room.site.code,
      siteTimezone: room.site.timezone,
      operatingHistory: current ? this.cycles.history(current) : null,
      ...signals,
    };
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
