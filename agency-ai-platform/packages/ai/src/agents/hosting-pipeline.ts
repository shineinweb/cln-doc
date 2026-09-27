/**
 * Hosting AI diagnostic pipeline — read-only checks, then diagnosis.
 *
 *   Customer request
 *           ↓
 *   Hosting AI
 *           ↓
 *   Identify hosting account
 *           ↓
 *   Check server
 *           ↓
 *   Check DNS
 *           ↓
 *   Check SSL
 *           ↓
 *   Check service status
 *           ↓
 *   Read safe logs
 *           ↓
 *   Search knowledge
 *           ↓
 *   Diagnosis
 *
 * Forbidden: AI → production server → randomly change files
 */

import type { HostingToolName } from "../tools/hosting-tools";

export const HOSTING_PIPELINE_STAGES = [
  "customer_request",
  "hosting_ai",
  "identify_hosting_account",
  "check_server",
  "check_dns",
  "check_ssl",
  "check_service_status",
  "read_safe_logs",
  "search_knowledge",
  "diagnosis",
] as const;

export type HostingPipelineStage = (typeof HOSTING_PIPELINE_STAGES)[number];

export type HostingPipelineStageDefinition = {
  stage: HostingPipelineStage;
  label: string;
  description: string;
  /** Tool used at this stage, if any. */
  tool: HostingToolName | null;
  /** Read-only diagnostic step (all hosting pipeline stages are). */
  readOnly: true;
};

export const HOSTING_PIPELINE_DIAGRAM = `
Customer request
        ↓
Hosting AI
        ↓
Identify hosting account
        ↓
Check server
        ↓
Check DNS
        ↓
Check SSL
        ↓
Check service status
        ↓
Read safe logs
        ↓
Search knowledge
        ↓
Diagnosis
`.trim();

export const HOSTING_PIPELINE: readonly HostingPipelineStageDefinition[] = [
  {
    stage: "customer_request",
    label: "Customer request",
    description: "Inbound portal/ticket/chat request routed by the Supervisor.",
    tool: null,
    readOnly: true,
  },
  {
    stage: "hosting_ai",
    label: "Hosting AI",
    description: "Supervisor hands off to the Hosting specialist.",
    tool: null,
    readOnly: true,
  },
  {
    stage: "identify_hosting_account",
    label: "Identify hosting account",
    description: "Resolve the correct HostingProvider account for the customer.",
    tool: "getHostingAccount",
    readOnly: true,
  },
  {
    stage: "check_server",
    label: "Check server",
    description: "Read-only host health (load, disk, reachability).",
    tool: "checkServer",
    readOnly: true,
  },
  {
    stage: "check_dns",
    label: "Check DNS",
    description: "Inspect DNS via DnsProvider.",
    tool: "getDNS",
    readOnly: true,
  },
  {
    stage: "check_ssl",
    label: "Check SSL",
    description: "Certificate validity and expiry.",
    tool: "getSSLStatus",
    readOnly: true,
  },
  {
    stage: "check_service_status",
    label: "Check service status",
    description: "HTTP/service status for the site.",
    tool: "checkServiceStatus",
    readOnly: true,
  },
  {
    stage: "read_safe_logs",
    label: "Read safe logs",
    description: "Allowlisted, redacted log snippets only.",
    tool: "readSafeLogs",
    readOnly: true,
  },
  {
    stage: "search_knowledge",
    label: "Search knowledge",
    description: "RAG over published hosting runbooks.",
    tool: "searchKnowledge",
    readOnly: true,
  },
  {
    stage: "diagnosis",
    label: "Diagnosis",
    description: "Synthesize findings into a diagnosis and next steps (no mutations).",
    tool: "diagnoseHosting",
    readOnly: true,
  },
] as const;

export function isHostingPipelineStage(
  value: string,
): value is HostingPipelineStage {
  return (HOSTING_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function getHostingPipelineStage(
  stage: HostingPipelineStage,
): HostingPipelineStageDefinition {
  const found = HOSTING_PIPELINE.find((item) => item.stage === stage);
  if (!found) {
    throw new Error(`Unknown hosting pipeline stage: ${stage}`);
  }
  return found;
}

export function getNextHostingPipelineStage(
  stage: HostingPipelineStage,
): HostingPipelineStage | null {
  const index = HOSTING_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= HOSTING_PIPELINE_STAGES.length - 1) return null;
  return HOSTING_PIPELINE_STAGES[index + 1] ?? null;
}

/** All diagnostic stages are read-only — no production file mutation. */
export function isHostingPipelineReadOnly(stage: HostingPipelineStage): boolean {
  return getHostingPipelineStage(stage).readOnly;
}
