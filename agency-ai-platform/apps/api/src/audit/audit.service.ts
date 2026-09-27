import { Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@agency/database";

export type AuditWriteInput = {
  actorUserId?: string | null;
  actorType: string;
  organizationId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson?: Prisma.InputJsonValue;
  afterJson?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  async write(input: AuditWriteInput) {
    return prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType,
        organizationId: input.organizationId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeJson: input.beforeJson,
        afterJson: input.afterJson,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}
