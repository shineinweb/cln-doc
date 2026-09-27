/**
 * Tenant isolation — Customer A must never access Customer B data.
 * Portal and AI tool paths bind organizationId to OrganizationMember.
 */

import type { AuthMembership, AuthUserView } from "./types";

export class OrganizationAccessError extends Error {
  readonly organizationId: string;
  readonly userId: string;

  constructor(userId: string, organizationId: string) {
    super(`User ${userId} cannot access organization ${organizationId}`);
    this.name = "OrganizationAccessError";
    this.userId = userId;
    this.organizationId = organizationId;
  }
}

export function membershipOrganizationIds(
  memberships: readonly AuthMembership[],
): readonly string[] {
  return memberships.map((membership) => membership.organizationId);
}

/** True when the user is an OrganizationMember of the tenant. */
export function canAccessOrganization(
  user: Pick<AuthUserView, "memberships">,
  organizationId: string,
): boolean {
  return user.memberships.some((membership) => membership.organizationId === organizationId);
}

/**
 * Enforce tenant isolation for customer-owned resources.
 * Staff do **not** bypass this helper — admin routes use RBAC separately.
 */
export function assertOrganizationAccess(
  user: Pick<AuthUserView, "id" | "memberships">,
  organizationId: string,
): void {
  if (!canAccessOrganization(user, organizationId)) {
    throw new OrganizationAccessError(user.id, organizationId);
  }
}
