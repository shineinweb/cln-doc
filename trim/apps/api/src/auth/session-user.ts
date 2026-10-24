import type { SessionUser } from '@trim/contracts';
import type { Prisma } from '@trim/database';
import { MODULE_PERMISSIONS } from './permissions';

export type UserWithAccess = Prisma.UserGetPayload<{
  include: {
    organization: true;
    memberships: true;
    userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } };
  };
}>;

export const userAccessInclude = {
  organization: true,
  memberships: true,
  userRoles: {
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export function toSessionUser(user: UserWithAccess): SessionUser {
  const isOrgAdmin = user.userRoles.some((assignment) => assignment.role.isOrgWide);
  const fromRoles = [
    ...new Set(
      user.userRoles.flatMap((assignment) => assignment.role.permissions.map((link) => link.permission.key)),
    ),
  ].sort();
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    isOrgAdmin,
    siteIds: user.memberships.map((membership) => membership.siteId),
    permissions: isOrgAdmin ? MODULE_PERMISSIONS.map((permission) => permission.key) : fromRoles,
  };
}
