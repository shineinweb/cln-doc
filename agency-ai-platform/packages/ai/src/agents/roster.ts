/**
 * Agent roster — supervisor + specialists.
 * PLACEHOLDER: prompts, tool allowlists, and runtimes land in Phase 8+.
 */

export const AI_AGENT_CODES = [
  "supervisor",
  "support",
  "coding",
  "hosting",
  "sales",
  "seo",
] as const;

export type AiAgentCode = (typeof AI_AGENT_CODES)[number];

export type AiAgentDefinition = {
  code: AiAgentCode;
  label: string;
  description: string;
  /** Tools this agent may call (empty until tools registry is wired). */
  toolAllowlist: string[];
};

export const AI_AGENT_ROSTER: readonly AiAgentDefinition[] = [
  {
    code: "supervisor",
    label: "AI Supervisor",
    description: "Route intents, enforce policy, synthesize final answers.",
    toolAllowlist: [],
  },
  {
    code: "support",
    label: "Customer Support AI",
    description: "Tickets, KB answers, troubleshooting.",
    toolAllowlist: [],
  },
  {
    code: "coding",
    label: "Coding AI",
    description: "Implementation guidance and task breakdown.",
    toolAllowlist: [],
  },
  {
    code: "hosting",
    label: "Hosting AI",
    description: "Hosting diagnostics and WHM-safe recommendations.",
    toolAllowlist: [],
  },
  {
    code: "sales",
    label: "Sales AI",
    description: "Qualification, quote drafts, plan recommendations.",
    toolAllowlist: [],
  },
  {
    code: "seo",
    label: "SEO AI",
    description: "Audits, content recommendations, keyword assist.",
    toolAllowlist: [],
  },
] as const;

export function getAgentDefinition(code: AiAgentCode): AiAgentDefinition {
  const agent = AI_AGENT_ROSTER.find((item) => item.code === code);
  if (!agent) {
    throw new Error(`Unknown AI agent: ${code}`);
  }
  return agent;
}
