import { ForbiddenException } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';

/** Catalog of module permissions Serenity enforces. */
export const MODULE_PERMISSIONS = [
  { key: 'dashboard.read', description: 'Open the main dashboard' },
  { key: 'access.manage', description: 'Manage users, roles, permissions, and view the full audit log' },
  { key: 'organization.read', description: 'View the organization profile' },
  { key: 'facilities.read', description: 'View facilities' },
  { key: 'facilities.write', description: 'Add, edit, or delete facilities' },
  { key: 'sites.read', description: 'View facilities the user is allowed to open' },
  { key: 'rooms.read', description: 'View rooms inside an authorized facility' },
  { key: 'rooms.write', description: 'Add, edit, reset, or delete rooms and room settings' },
  { key: 'zones.read', description: 'View zones inside an authorized room' },
  { key: 'zones.write', description: 'Add, edit, or delete zones' },
  { key: 'tasks.read', description: 'View crop-cycle, room, and workspace tasks' },
  { key: 'tasks.write', description: 'Create, edit, or complete tasks' },
  { key: 'timeclock.punch', description: 'Clock in, lunch, and clock out' },
  { key: 'timeclock.manage', description: 'View payroll, set labor rates, and ask AI payroll' },
  { key: 'compliance.read', description: 'View compliance and Metrc submissions' },
  { key: 'compliance.write', description: 'Create or change compliance submissions' },
  { key: 'harvests.read', description: 'View harvests and packages' },
  { key: 'harvests.write', description: 'Record or change harvests and packages' },
  { key: 'operations.read', description: 'View Operations lists' },
  { key: 'operations.write', description: 'Add or change Operations records' },
  { key: 'reports.read', description: 'View reports and dashboard analytics' },
  { key: 'coach.use', description: 'Use Serenity, the cultivation AI' },
  { key: 'messages.use', description: 'Send and read internal messages' },
  { key: 'settings.manage', description: 'Change organization settings and API credentials' },
  { key: 'workflows.manage', description: 'Manage workflow templates and teams' },
  { key: 'inventory.read', description: 'View plants and license inventory' },
  { key: 'inventory.write', description: 'Change plants and license inventory' },
] as const;

export type ModulePermissionKey = (typeof MODULE_PERMISSIONS)[number]['key'];

/** Permissions granted to site operators by default (not org-wide admins). */
export const OPERATOR_PERMISSION_KEYS: ModulePermissionKey[] = [
  'dashboard.read',
  'organization.read',
  'facilities.read',
  'sites.read',
  'rooms.read',
  'rooms.write',
  'zones.read',
  'zones.write',
  'tasks.read',
  'tasks.write',
  'timeclock.punch',
  'compliance.read',
  'compliance.write',
  'harvests.read',
  'harvests.write',
  'operations.read',
  'operations.write',
  'reports.read',
  'coach.use',
  'messages.use',
  'inventory.read',
  'inventory.write',
];

export function hasPermission(user: SessionUser, permission: string): boolean {
  if (user.isOrgAdmin) {
    return true;
  }
  return user.permissions.includes(permission);
}

export function assertPermission(user: SessionUser, ...permissions: string[]): void {
  const missing = permissions.filter((permission) => !hasPermission(user, permission));
  if (missing.length > 0) {
    throw new ForbiddenException(`You do not have permission for ${missing.join(', ')}.`);
  }
}
