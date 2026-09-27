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

export type PlatformPermissionDef = {
  key: string;
  description: string;
};

export type PlatformRoleDef = {
  key: PlatformRoleKey;
  name: string;
  description: string;
  /** Staff console role (eligible for UserRole assignment). */
  isStaff: boolean;
  permissions: readonly string[];
};

export const PLATFORM_PERMISSIONS: readonly PlatformPermissionDef[] = [
  { key: "*", description: "Unrestricted access (super admin only)" },
  { key: "audit.read", description: "Read audit logs" },
  { key: "settings.read", description: "View system settings" },
  { key: "settings.write", description: "Change system settings" },
  { key: "roles.read", description: "View roles and permissions" },
  { key: "roles.write", description: "Manage roles and permissions" },
  { key: "crm.leads.read", description: "View leads" },
  { key: "crm.leads.write", description: "Create/update leads" },
  { key: "crm.customers.read", description: "View customers" },
  { key: "crm.customers.write", description: "Create/update customers" },
  { key: "sales.quotes.read", description: "View quotes" },
  { key: "sales.quotes.write", description: "Create/update quotes" },
  { key: "sales.contracts.read", description: "View contracts" },
  { key: "sales.contracts.write", description: "Create/update contracts" },
  { key: "projects.read", description: "View projects and tasks" },
  { key: "projects.write", description: "Manage projects and tasks" },
  { key: "hosting.accounts.read", description: "View hosting accounts" },
  { key: "hosting.accounts.write", description: "Provision/manage hosting" },
  { key: "hosting.accounts.suspend", description: "Suspend hosting accounts" },
  { key: "domains.read", description: "View domains and DNS" },
  { key: "domains.write", description: "Register/manage domains" },
  { key: "domains.transfer", description: "Transfer domains" },
  { key: "billing.invoices.read", description: "View invoices" },
  { key: "billing.invoices.write", description: "Create/update invoices" },
  { key: "billing.refunds.create", description: "Issue refunds" },
  { key: "billing.subscriptions.read", description: "View subscriptions" },
  { key: "billing.subscriptions.write", description: "Manage subscriptions" },
  { key: "support.tickets.read", description: "View support tickets" },
  { key: "support.tickets.write", description: "Manage support tickets" },
  { key: "kb.read", description: "View knowledge base" },
  { key: "kb.write", description: "Manage knowledge base" },
  { key: "seo.projects.read", description: "View SEO work" },
  { key: "seo.projects.write", description: "Manage SEO work" },
  { key: "design.projects.read", description: "View design work" },
  { key: "design.projects.write", description: "Manage design work" },
  { key: "ai.approvals.decide", description: "Approve or deny AI tool actions" },
  { key: "ai.runs.read", description: "View AI runs" },
  { key: "reports.read", description: "View operational reports" },
  { key: "portal.*", description: "Customer portal baseline access" },
] as const;

const ALL_STAFF_PERMISSION_KEYS = PLATFORM_PERMISSIONS.map((p) => p.key).filter(
  (key) => key !== "*" && key !== "portal.*",
);

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
    permissions: ALL_STAFF_PERMISSION_KEYS,
  },
  {
    key: "manager",
    name: "Manager",
    description: "Delivery and account management oversight",
    isStaff: true,
    permissions: [
      "audit.read",
      "crm.leads.read",
      "crm.customers.read",
      "crm.customers.write",
      "sales.quotes.read",
      "sales.contracts.read",
      "projects.read",
      "projects.write",
      "support.tickets.read",
      "reports.read",
      "ai.runs.read",
      "kb.read",
    ],
  },
  {
    key: "sales",
    name: "Sales",
    description: "Leads, quotes, and contracts",
    isStaff: true,
    permissions: [
      "crm.leads.read",
      "crm.leads.write",
      "crm.customers.read",
      "crm.customers.write",
      "sales.quotes.read",
      "sales.quotes.write",
      "sales.contracts.read",
      "sales.contracts.write",
      "reports.read",
    ],
  },
  {
    key: "developer",
    name: "Developer",
    description: "Engineering delivery on projects",
    isStaff: true,
    permissions: [
      "projects.read",
      "projects.write",
      "support.tickets.read",
      "kb.read",
      "ai.runs.read",
    ],
  },
  {
    key: "designer",
    name: "Designer",
    description: "Design delivery on projects",
    isStaff: true,
    permissions: [
      "projects.read",
      "projects.write",
      "design.projects.read",
      "design.projects.write",
      "kb.read",
    ],
  },
  {
    key: "seo_specialist",
    name: "SEO Specialist",
    description: "SEO audits and optimization work",
    isStaff: true,
    permissions: [
      "projects.read",
      "seo.projects.read",
      "seo.projects.write",
      "crm.customers.read",
      "kb.read",
    ],
  },
  {
    key: "hosting_technician",
    name: "Hosting Technician",
    description: "Hosting, servers, and domain operations",
    isStaff: true,
    permissions: [
      "hosting.accounts.read",
      "hosting.accounts.write",
      "hosting.accounts.suspend",
      "domains.read",
      "domains.write",
      "domains.transfer",
      "support.tickets.read",
      "support.tickets.write",
      "ai.approvals.decide",
    ],
  },
  {
    key: "support_agent",
    name: "Support Agent",
    description: "Customer support and knowledge base",
    isStaff: true,
    permissions: [
      "support.tickets.read",
      "support.tickets.write",
      "crm.customers.read",
      "kb.read",
      "kb.write",
      "ai.runs.read",
      "ai.approvals.decide",
    ],
  },
  {
    key: "billing",
    name: "Billing",
    description: "Invoices, subscriptions, and refunds",
    isStaff: true,
    permissions: [
      "billing.invoices.read",
      "billing.invoices.write",
      "billing.refunds.create",
      "billing.subscriptions.read",
      "billing.subscriptions.write",
      "crm.customers.read",
      "audit.read",
      "reports.read",
    ],
  },
  {
    key: "customer",
    name: "Customer",
    description: "Customer portal actor (tenant-scoped via organization membership)",
    isStaff: false,
    permissions: ["portal.*"],
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
