/**
 * DEVELOPMENT PLACEHOLDER DATA for client portal hosting views.
 * Replace with API / HostingProvider-backed data before production.
 */

const GIB = 1024 ** 3;

export const PLACEHOLDER_NOTICE =
  "Development placeholder — not live WHM/cPanel usage data.";

export type PortalHostingAccountView = {
  id: string;
  domain: string;
  packageName: string;
  statusLabel: "Active" | "Suspended" | "Provisioning" | "Terminated";
  diskUsedBytes: number;
  diskLimitBytes: number | null;
  bandwidthUsedBytes: number;
  bandwidthLimitBytes: number | null;
};

export const PLACEHOLDER_HOSTING_ACCOUNTS: PortalHostingAccountView[] = [
  {
    id: "ha_example",
    domain: "example.com",
    packageName: "Business Hosting",
    statusLabel: "Active",
    diskUsedBytes: 14 * GIB,
    diskLimitBytes: 50 * GIB,
    bandwidthUsedBytes: 34 * GIB,
    bandwidthLimitBytes: 500 * GIB,
  },
];

export const PORTAL_NAV = [
  { to: "/", label: "Home" },
  { to: "/hosting", label: "Hosting" },
] as const;
