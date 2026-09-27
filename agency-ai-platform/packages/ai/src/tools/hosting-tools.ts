/**
 * Hosting AI tool surface — read-only diagnostics via providers.
 * Never mutates production files (see security/forbidden-paths).
 */

import type { AiToolDefinition } from "./types";

/** Includes shared `searchKnowledge` (defined on Customer Support tools). */
export const HOSTING_TOOL_NAMES = [
  "identifyHostingAccount",
  "checkServer",
  "checkDns",
  "checkSsl",
  "checkServiceStatus",
  "readSafeLogs",
  "searchKnowledge",
  "diagnoseHosting",
] as const;

export type HostingToolName = (typeof HOSTING_TOOL_NAMES)[number];

/** Hosting-specific tools only (searchKnowledge lives in customer-support-tools). */
export const HOSTING_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "identifyHostingAccount",
    description:
      "Resolve the customer's hosting account from domain, username, or account id.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      domain: {
        type: "string",
        description: "Domain name associated with the account.",
        required: false,
      },
      username: {
        type: "string",
        description: "cPanel/WHM username if known.",
        required: false,
      },
      hostingAccountId: {
        type: "string",
        description: "Internal hosting account id if known.",
        required: false,
      },
    },
  },
  {
    name: "checkServer",
    description:
      "Read-only server health for the account's host (load, disk, reachability).",
    risk: "read",
    requiresApproval: false,
    parameters: {
      hostingAccountId: {
        type: "string",
        description: "Hosting account id from identifyHostingAccount.",
        required: true,
      },
    },
  },
  {
    name: "checkDns",
    description:
      "Check DNS records for the account's domain via DnsProvider (read-only).",
    risk: "read",
    requiresApproval: false,
    parameters: {
      domain: {
        type: "string",
        description: "Domain to inspect.",
        required: true,
      },
    },
  },
  {
    name: "checkSsl",
    description: "Check SSL certificate status and expiry for the domain.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      domain: {
        type: "string",
        description: "Domain whose certificate to inspect.",
        required: true,
      },
    },
  },
  {
    name: "checkServiceStatus",
    description:
      "Check HTTP/service status for the site (uptime, response code) — read-only.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      hostingAccountId: {
        type: "string",
        description: "Hosting account id.",
        required: true,
      },
      service: {
        type: "string",
        description: "Optional service name (e.g. httpd, nginx, php-fpm).",
        required: false,
      },
    },
  },
  {
    name: "readSafeLogs",
    description:
      "Read allowlisted, redacted log snippets only — never arbitrary filesystem access.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      hostingAccountId: {
        type: "string",
        description: "Hosting account id.",
        required: true,
      },
      logKind: {
        type: "string",
        description: "Allowlisted log kind (e.g. access, error, ssl).",
        required: true,
      },
      lines: {
        type: "number",
        description: "Max lines to return (capped by policy).",
        required: false,
      },
    },
  },
  {
    name: "diagnoseHosting",
    description:
      "Synthesize a hosting diagnosis from prior check results (no mutations).",
    risk: "read",
    requiresApproval: false,
    parameters: {
      hostingAccountId: {
        type: "string",
        description: "Hosting account id under diagnosis.",
        required: true,
      },
      findings: {
        type: "string",
        description: "JSON or text summary of prior check outputs.",
        required: false,
      },
    },
  },
] as const;
