import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import type { Prisma } from '@trim/database';

export function authorizedSiteWhere(user: SessionUser): Prisma.SiteWhereInput {
  if (user.isOrgAdmin) {
    return { organizationId: user.organizationId };
  }
  return {
    organizationId: user.organizationId,
    id: { in: user.siteIds },
  };
}

export function assertSiteAccess<T extends { id: string; organizationId: string }>(
  user: SessionUser,
  site: T | null,
): asserts site is T {
  if (!site || site.organizationId !== user.organizationId) {
    throw new NotFoundException('Site not found');
  }
  if (!user.isOrgAdmin && !user.siteIds.includes(site.id)) {
    throw new ForbiddenException('You do not have access to this site');
  }
}
