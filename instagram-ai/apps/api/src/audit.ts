import type { Prisma, PrismaClient } from '@prisma/client'

export async function audit(
  prisma: PrismaClient,
  entry: {
    organizationId?: string | null
    actorType: string
    actorId?: string | null
    action: string
    targetType?: string
    targetId?: string
    metadata?: Prisma.InputJsonValue
  },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: entry.organizationId ?? null,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
    },
  })
}
