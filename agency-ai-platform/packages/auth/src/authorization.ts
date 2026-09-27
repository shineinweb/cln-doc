/**
 * Authorization helpers (authn ≠ authz).
 * Permission checks for staff actions and role catalog resolution.
 */

import { hasPermission } from "./permissions";
import { getPlatformRole, type PlatformPermissionKey, type PlatformRoleKey } from "./roles";
import type { AuthUserView } from "./types";

export class AuthorizationError extends Error {
  readonly code: string;

  constructor(message: string, code = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/** Resolve catalog permissions for a platform role (tests + seed helpers). */
export function permissionsForPlatformRole(roleKey: PlatformRoleKey): string[] {
  const role = getPlatformRole(roleKey);
  if (role.permissions.includes("*")) {
    return ["*"];
  }
  return [...role.permissions];
}

export function assertPermission(
  granted: readonly string[],
  required: PlatformPermissionKey | string,
): void {
  if (!hasPermission(granted, required)) {
    throw new AuthorizationError(`Missing required permission: ${required}`, "MISSING_PERMISSION");
  }
}

/** Staff console routes require isStaff (customers never access /admin). */
export function assertStaff(user: Pick<AuthUserView, "isStaff" | "id">): void {
  if (!user.isStaff) {
    throw new AuthorizationError("Staff access required", "STAFF_REQUIRED");
  }
}

/** Refund issuance requires billing.refund — support_agent etc. must fail. */
export function assertCanIssueRefund(granted: readonly string[]): void {
  assertPermission(granted, "billing.refund");
}

export function canIssueRefund(granted: readonly string[]): boolean {
  return hasPermission(granted, "billing.refund");
}
