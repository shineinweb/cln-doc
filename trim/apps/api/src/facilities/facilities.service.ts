import { Injectable, NotFoundException } from '@nestjs/common';
import type { OrganizationSummary, Room, RoomDetail, SessionUser, Site, Zone } from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { assertSiteAccess, authorizedSiteWhere } from './site-access';

const roomInclude = {
  zones: { orderBy: { name: 'asc' as const } },
};

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSites(user: SessionUser): Promise<Site[]> {
    const sites = await this.prisma.site.findMany({
      where: authorizedSiteWhere(user),
      include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return sites.map((site) => this.toSite(site));
  }

  async getSite(user: SessionUser, siteId: string): Promise<Site> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { rooms: { include: roomInclude, orderBy: { name: 'asc' } } },
    });
    assertSiteAccess(user, site);
    return this.toSite(site);
  }

  async listRooms(user: SessionUser, siteId: string): Promise<Room[]> {
    const site = await this.getSite(user, siteId);
    return site.rooms;
  }

  async getRoom(user: SessionUser, roomId: string): Promise<RoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { zones: { orderBy: { name: 'asc' } }, site: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    assertSiteAccess(user, room.site);
    return {
      ...this.toRoom(room),
      siteName: room.site.name,
      siteCode: room.site.code,
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

  private toSite(site: {
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
    rooms: Array<Parameters<FacilitiesService['toRoom']>[0]>;
  }): Site {
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
      rooms: site.rooms.map((room) => this.toRoom(room)),
    };
  }

  private toRoom(room: {
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
  }): Room {
    return {
      id: room.id,
      siteId: room.siteId,
      name: room.name,
      code: room.code,
      roomType: room.roomType,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
      zones: room.zones.map((zone) => this.toZone(zone)),
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
