import { BadRequestException, Injectable } from '@nestjs/common';
import type { SessionUser, TrolmasterConnection, TrolmasterInput } from '@trim/contracts';
import { assertSiteAccess } from '../facilities/site-access';
import { PrismaService } from '../prisma/prisma.service';

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
