import type { SessionUser } from '@trim/contracts';

/** True when the signed-in user holds any of the listed permission keys (org admins always pass). */
export function can(user: SessionUser | null | undefined, ...permissions: string[]): boolean {
  if (!user) {
    return false;
  }
  if (user.isOrgAdmin) {
    return true;
  }
  return permissions.some((permission) => user.permissions.includes(permission));
}
