/**
 * Agent roster — AI Supervisor org chart + specialists.
 * PLACEHOLDER: prompts, tool allowlists, and runtimes land in Phase 8+.
 *
 * Org chart:
 *
 *                   AI SUPERVISOR
 *                         │
 *        ┌────────────────┼─────────────────┐
 *        │                │                 │
 *  Customer Support     Coding           Hosting
 *        │                │                 │
 *        ├────────────── Sales ─────────────┤
 *        │                                  │
 *       SEO                              Knowledge
 */

import {
  CODING_TOOL_NAMES,
  CUSTOMER_SUPPORT_TOOL_NAMES,
  HOSTING_TOOL_NAMES,
} from "../tools/registry";

export const AI_AGENT_CODES = [
  "supervisor",
  "support",
  "coding",
  "hosting",
  "sales",
  "seo",
  "knowledge",
] as const;

export type AiAgentCode = (typeof AI_AGENT_CODES)[number];

/** Position in the supervisor org chart. */
export type AiAgentTier =
  | "supervisor"
  | "primary"
  | "cross_cutting"
  | "specialty";

export type AiAgentDefinition = {
  code: AiAgentCode;
  label: string;
  description: string;
  /** `null` only for the root AI Supervisor. */
  reportsTo: AiAgentCode | null;
  tier: AiAgentTier;
  /** Tools this agent may call (empty until tools registry is wired). */
  toolAllowlist: string[];
};

export const AI_ORG_CHART = `
                  AI SUPERVISOR
                        │
       ┌────────────────┼─────────────────┐
       │                │                 │
 Customer Support     Coding           Hosting
       │                │                 │
       ├────────────── Sales ─────────────┤
       │                                  │
      SEO                              Knowledge
`.trim();

export const AI_AGENT_ROSTER: readonly AiAgentDefinition[] = [
  {
    code: "supervisor",
    label: "AI Supervisor",
    description: "Route intents, enforce policy, synthesize final answers.",
    reportsTo: null,
    tier: "supervisor",
    toolAllowlist: [],
  },
  {
    code: "support",
    label: "Customer Support",
    description: "Tickets, KB answers, troubleshooting.",
    reportsTo: "supervisor",
    tier: "primary",
    toolAllowlist: [...CUSTOMER_SUPPORT_TOOL_NAMES],
  },
  {
    code: "coding",
    label: "Coding",
    description: "Implementation guidance and task breakdown.",
    reportsTo: "supervisor",
    tier: "primary",
    toolAllowlist: [...CODING_TOOL_NAMES],
  },
  {
    code: "hosting",
    label: "Hosting",
    description: "Hosting diagnostics and WHM-safe recommendations.",
    reportsTo: "supervisor",
    tier: "primary",
    toolAllowlist: [...HOSTING_TOOL_NAMES],
  },
  {
    code: "sales",
    label: "Sales",
    description:
      "Cross-cutting qualification, quote drafts, plan recommendations.",
    reportsTo: "supervisor",
    tier: "cross_cutting",
    toolAllowlist: [
      "getCurrentCustomer",
      "getCustomerServices",
      "getCustomerInvoices",
      "searchKnowledge",
    ],
  },
  {
    code: "seo",
    label: "SEO",
    description: "Audits, content recommendations, keyword assist.",
    reportsTo: "supervisor",
    tier: "specialty",
    toolAllowlist: ["searchKnowledge"],
  },
  {
    code: "knowledge",
    label: "Knowledge",
    description: "RAG curation, collection scoping, retrieval quality assist.",
    reportsTo: "supervisor",
    tier: "specialty",
    toolAllowlist: ["searchKnowledge"],
  },
] as const;

export function getAgentDefinition(code: AiAgentCode): AiAgentDefinition {
  const agent = AI_AGENT_ROSTER.find((item) => item.code === code);
  if (!agent) {
    throw new Error(`Unknown AI agent: ${code}`);
  }
  return agent;
}

/** Specialists that report to the AI Supervisor (excludes the supervisor itself). */
export function listSpecialists(): readonly AiAgentDefinition[] {
  return AI_AGENT_ROSTER.filter((agent) => agent.reportsTo === "supervisor");
}

export function listAgentsByTier(tier: AiAgentTier): readonly AiAgentDefinition[] {
  return AI_AGENT_ROSTER.filter((agent) => agent.tier === tier);
}
