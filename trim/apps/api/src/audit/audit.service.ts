import { Injectable } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    user: Pick<SessionUser, 'id' | 'name' | 'organizationId'>,
    input: { action: string; entityType: string; entityId?: string | null; summary: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        actorId: user.id,
        actorName: user.name,
        action: input.action.slice(0, 64),
        entityType: input.entityType.slice(0, 64),
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
      },
    });
  }
}
