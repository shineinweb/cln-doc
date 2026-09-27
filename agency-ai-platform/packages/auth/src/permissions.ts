export const PORTAL_PERMISSIONS = {
  OWNER: ["portal.*", "portal.billing.read", "portal.billing.write", "portal.members.write"],
  ADMIN: ["portal.*", "portal.billing.read", "portal.members.write"],
  MEMBER: ["portal.*"],
} as const;

export function hasPermission(granted: readonly string[], required: string): boolean {
  if (granted.includes(required)) {
    return true;
  }
  const [namespace] = required.split(".");
  return granted.includes(`${namespace}.*`) || granted.includes("*");
}

export function hasAllPermissions(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((permission) => hasPermission(granted, permission));
}
