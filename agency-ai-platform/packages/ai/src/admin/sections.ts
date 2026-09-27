/**
 * Admin AI management surface — sections under /admin/ai.
 *
 * AI Agents · AI Conversations · AI Tool Calls · AI Costs · Token Usage ·
 * Knowledge · Feedback · Evaluations · Approvals · Failures · Security Events
 */

export const ADMIN_AI_SECTIONS = [
  {
    key: "agents",
    label: "AI Agents",
    path: "agents",
    apiPath: "/admin/ai/agents",
    description: "Supervisor + specialist roster, versions, tool allowlists.",
  },
  {
    key: "conversations",
    label: "AI Conversations",
    path: "conversations",
    apiPath: "/admin/ai/conversations",
    description: "Portal and staff AI conversation threads.",
  },
  {
    key: "tool_calls",
    label: "AI Tool Calls",
    path: "tool-calls",
    apiPath: "/admin/ai/tool-calls",
    description: "AiToolCall history with risk, latency, and outcomes.",
  },
  {
    key: "costs",
    label: "AI Costs",
    path: "costs",
    apiPath: "/admin/ai/costs",
    description: "Estimated spend by agent, model, and organization.",
  },
  {
    key: "token_usage",
    label: "Token Usage",
    path: "token-usage",
    apiPath: "/admin/ai/token-usage",
    description: "Prompt/completion token totals and budgets.",
  },
  {
    key: "knowledge",
    label: "Knowledge",
    path: "knowledge",
    apiPath: "/admin/ai/knowledge",
    description: "Proposals, index jobs, and RAG retrieval health.",
  },
  {
    key: "feedback",
    label: "Feedback",
    path: "feedback",
    apiPath: "/admin/ai/feedback",
    description: "Thumbs, ratings, and comments on AI answers.",
  },
  {
    key: "evaluations",
    label: "Evaluations",
    path: "evaluations",
    apiPath: "/admin/ai/evaluations",
    description: "Eval suites, scores, and regression harness runs.",
  },
  {
    key: "approvals",
    label: "Approvals",
    path: "approvals",
    apiPath: "/admin/ai/approvals",
    description: "Human-in-the-loop queue for gated tools.",
  },
  {
    key: "failures",
    label: "Failures",
    path: "failures",
    apiPath: "/admin/ai/failures",
    description: "Failed runs, tool errors, and provider outages.",
  },
  {
    key: "security_events",
    label: "Security Events",
    path: "security-events",
    apiPath: "/admin/ai/security-events",
    description: "Policy denials, kill-switch hits, and forbidden paths.",
  },
] as const;

export type AdminAiSectionKey = (typeof ADMIN_AI_SECTIONS)[number]["key"];
export type AdminAiSection = (typeof ADMIN_AI_SECTIONS)[number];

export function getAdminAiSection(key: AdminAiSectionKey): AdminAiSection {
  const section = ADMIN_AI_SECTIONS.find((item) => item.key === key);
  if (!section) {
    throw new Error(`Unknown admin AI section: ${key}`);
  }
  return section;
}

export function getAdminAiSectionByPath(path: string): AdminAiSection | undefined {
  return ADMIN_AI_SECTIONS.find((item) => item.path === path);
}
