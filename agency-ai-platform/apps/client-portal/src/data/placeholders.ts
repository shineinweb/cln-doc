/**
 * DEVELOPMENT PLACEHOLDER DATA for client portal views.
 * Replace with API / provider-backed data before production.
 */

import type { SupportTicketPriorityValue } from "@agency/shared";

const GIB = 1024 ** 3;

export const PLACEHOLDER_NOTICE =
  "Development placeholder — not loaded from the portal API.";

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

/** Prefill for the New Ticket form demo (matches product mock). */
export const PLACEHOLDER_NEW_TICKET = {
  department: "hosting",
  priority: "HIGH" as SupportTicketPriorityValue,
  subject: "Website unavailable",
  message:
    "Our site at example.com is returning errors for visitors. It started this morning after a deploy.",
} as const;

export const PLACEHOLDER_PORTAL_TICKETS = [
  {
    id: "tkt_portal_1",
    number: 1002,
    department: "domains",
    priority: "MEDIUM" as SupportTicketPriorityValue,
    subject: "DNS change for www.example.com",
    status: "CUSTOMER_REPLY",
    statusLabel: "Customer Reply",
  },
  {
    id: "tkt_portal_2",
    number: 998,
    department: "billing",
    priority: "LOW" as SupportTicketPriorityValue,
    subject: "Invoice copy request",
    status: "RESOLVED",
    statusLabel: "Resolved",
  },
  {
    id: "tkt_portal_3",
    number: 1005,
    department: "hosting",
    priority: "HIGH" as SupportTicketPriorityValue,
    subject: "Website unavailable",
    status: "PENDING",
    statusLabel: "Pending",
  },
] as const;

export const PORTAL_NAV = [
  { to: "/", label: "Home" },
  { to: "/hosting", label: "Hosting" },
  { to: "/tickets", label: "Tickets" },
  { to: "/ai", label: "Ask AI" },
] as const;

/** Home dashboard PLACEHOLDER — matches portal welcome wireframe. */
export const PLACEHOLDER_DASHBOARD = {
  stats: [
    { key: "websites", label: "Websites", value: 3, to: "/" },
    { key: "domains", label: "Domains", value: 8, to: "/" },
    { key: "hosting", label: "Hosting", value: 3, to: "/hosting" },
    { key: "open_tickets", label: "Open Tickets", value: 1, to: "/tickets" },
  ],
  projects: [
    {
      id: "proj_company_site",
      name: "Company Website",
      progressPercent: 72,
    },
  ],
  services: [
    { id: "svc_1", name: "example.com", detail: "Hosting Active" },
    { id: "svc_2", name: "company.com", detail: "Domain Active" },
    { id: "svc_3", name: "SEO Management", detail: "Active" },
  ],
  invoice: {
    amountLabel: "$248",
    dueLabel: "due Oct 1",
  },
  aiPromptPlaceholder: "Ask AI anything about your account...",
} as const;
