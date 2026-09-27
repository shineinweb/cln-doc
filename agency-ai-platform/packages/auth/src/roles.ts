/**
 * Platform RBAC role catalog.
 * Staff roles are assigned via UserRole. "customer" is the portal actor catalog entry
 * (tenant access still enforced via OrganizationMember).
 */

export type PlatformRoleKey =
  | "super_admin"
  | "administrator"
  | "manager"
  | "sales"
  | "developer"
  | "designer"
  | "seo_specialist"
  | "hosting_technician"
  | "support_agent"
  | "billing"
  | "customer";

export type PlatformPermissionKey =
  | "customers.view"
  | "customers.create"
  | "customers.edit"
  | "customers.delete"
  | "projects.view"
  | "projects.create"
  | "projects.edit"
  | "hosting.view"
  | "hosting.create"
  | "hosting.suspend"
  | "domains.view"
  | "domains.manage"
  | "billing.view"
  | "billing.refund"
  | "ai.use"
  | "ai.manage"
  | "ai.approve"
  | "users.manage"
  | "roles.manage";

export type PlatformPermissionDef = {
  key: PlatformPermissionKey;
  description: string;
};

export type PlatformRoleDef = {
  key: PlatformRoleKey;
  name: string;
  description: string;
  /** Staff console role (eligible for UserRole assignment). */
  isStaff: boolean;
  /** Permission keys, or `*` for unrestricted super admin. */
  permissions: readonly ("*" | PlatformPermissionKey)[];
};

export const PLATFORM_PERMISSIONS: readonly PlatformPermissionDef[] = [
  { key: "customers.view", description: "View customers" },
  { key: "customers.create", description: "Create customers" },
  { key: "customers.edit", description: "Edit customers" },
  { key: "customers.delete", description: "Delete customers" },
  { key: "projects.view", description: "View projects" },
  { key: "projects.create", description: "Create projects" },
  { key: "projects.edit", description: "Edit projects" },
  { key: "hosting.view", description: "View hosting accounts" },
  { key: "hosting.create", description: "Create hosting accounts" },
  { key: "hosting.suspend", description: "Suspend hosting accounts" },
  { key: "domains.view", description: "View domains" },
  { key: "domains.manage", description: "Manage domains and DNS" },
  { key: "billing.view", description: "View billing" },
  { key: "billing.refund", description: "Issue refunds" },
  { key: "ai.use", description: "Use AI assistants" },
  { key: "ai.manage", description: "Manage AI configuration" },
  { key: "ai.approve", description: "Approve high-risk AI actions" },
  { key: "users.manage", description: "Manage users" },
  { key: "roles.manage", description: "Manage roles and permissions" },
] as const;

export const PLATFORM_PERMISSION_KEYS = PLATFORM_PERMISSIONS.map(
  (permission) => permission.key,
) as PlatformPermissionKey[];

const ALL_PERMISSION_KEYS = PLATFORM_PERMISSION_KEYS;

export const PLATFORM_ROLES: readonly PlatformRoleDef[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Full platform control including roles and system settings",
    isStaff: true,
    permissions: ["*"],
  },
  {
    key: "administrator",
    name: "Administrator",
    description: "Broad staff administration without unrestricted wildcard",
    isStaff: true,
    permissions: ALL_PERMISSION_KEYS,
  },
  {
    key: "manager",
    name: "Manager",
    description: "Delivery and account management oversight",
    isStaff: true,
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "projects.view",
      "projects.create",
      "projects.edit",
      "hosting.view",
      "domains.view",
      "billing.view",
      "ai.use",
      "users.manage",
    ],
  },
  {
    key: "sales",
    name: "Sales",
    description: "Leads, quotes, and customer acquisition",
    isStaff: true,
    permissions: [
      "customers.view",
      "customers.create",
      "customers.edit",
      "projects.view",
      "billing.view",
      "ai.use",
    ],
  },
  {
    key: "developer",
    name: "Developer",
    description: "Engineering delivery on projects",
    isStaff: true,
    permissions: ["projects.view", "projects.create", "projects.edit", "ai.use"],
  },
  {
    key: "designer",
    name: "Designer",
    description: "Design delivery on projects",
    isStaff: true,
    permissions: ["projects.view", "projects.create", "projects.edit", "ai.use"],
  },
  {
    key: "seo_specialist",
    name: "SEO Specialist",
    description: "SEO audits and optimization work",
    isStaff: true,
    permissions: ["customers.view", "projects.view", "projects.edit", "ai.use"],
  },
  {
    key: "hosting_technician",
    name: "Hosting Technician",
    description: "Hosting, servers, and domain operations",
    isStaff: true,
    permissions: [
      "hosting.view",
      "hosting.create",
      "hosting.suspend",
      "domains.view",
      "domains.manage",
      "customers.view",
      "ai.use",
      "ai.approve",
    ],
  },
  {
    key: "support_agent",
    name: "Support Agent",
    description: "Customer support",
    isStaff: true,
    permissions: ["customers.view", "projects.view", "hosting.view", "domains.view", "ai.use"],
  },
  {
    key: "billing",
    name: "Billing",
    description: "Invoices, subscriptions, and refunds",
    isStaff: true,
    permissions: ["customers.view", "billing.view", "billing.refund", "ai.use"],
  },
  {
    key: "customer",
    name: "Customer",
    description: "Customer portal actor (tenant-scoped via organization membership)",
    isStaff: false,
    permissions: ["ai.use"],
  },
] as const;

export const PLATFORM_ROLE_KEYS = PLATFORM_ROLES.map((role) => role.key);

export function getPlatformRole(key: PlatformRoleKey): PlatformRoleDef {
  const role = PLATFORM_ROLES.find((item) => item.key === key);
  if (!role) {
    throw new Error(`Unknown platform role: ${key}`);
  }
  return role;
}

export function isStaffRoleKey(key: string): boolean {
  return PLATFORM_ROLES.some((role) => role.key === key && role.isStaff);
}
