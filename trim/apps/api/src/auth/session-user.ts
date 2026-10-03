import type { SessionUser } from '@trim/contracts';
import type { Prisma } from '@trim/database';

export type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    organization: true;
    memberships: true;
    userRoles: { include: { role: true } };
  };
}>;

export const userAccessInclude = {
  organization: true,
  memberships: true,
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export function toSessionUser(user: UserWithAccess): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    isOrgAdmin: user.userRoles.some((assignment) => assignment.role.isOrgWide),
    siteIds: user.memberships.map((membership) => membership.siteId),
  };
}
