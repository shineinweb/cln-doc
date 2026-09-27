/**
 * Knowledge capture pipeline — resolve → propose → human approve → index.
 *
 *   Customer asks question
 *           ↓
 *   AI answers
 *           ↓
 *   Problem resolved?
 *           ↓
 *   YES
 *           ↓
 *   AI extracts reusable knowledge
 *           ↓
 *   Creates Knowledge Proposal
 *           ↓
 *   Human review
 *           ↓
 *   Approve
 *           ↓
 *   Knowledge Base
 *           ↓
 *   Embedding/index update
 *           ↓
 *   Future AI can retrieve it
 *
 * If not resolved: stop — do not create a Knowledge Proposal.
 */

import type { KnowledgeToolName } from "../tools/knowledge-tools";

export const KNOWLEDGE_PIPELINE_STAGES = [
  "customer_asks_question",
  "ai_answers",
  "problem_resolved_gate",
  "extract_reusable_knowledge",
  "create_knowledge_proposal",
  "human_review",
  "approve",
  "knowledge_base",
  "embedding_index_update",
  "future_retrieval",
] as const;

export type KnowledgePipelineStage = (typeof KNOWLEDGE_PIPELINE_STAGES)[number];

export type KnowledgePipelineActor =
  "customer" | "support_ai" | "knowledge_ai" | "human" | "system";

export type KnowledgePipelineStageDefinition = {
  stage: KnowledgePipelineStage;
  label: string;
  description: string;
  actors: readonly KnowledgePipelineActor[];
  tool: KnowledgeToolName | null;
  /** Human-only stages — Knowledge AI must not auto-publish. */
  humanOnly: boolean;
};

export const KNOWLEDGE_PIPELINE_DIAGRAM = `
Customer asks question
        ↓
AI answers
        ↓
Problem resolved?
        ↓
YES
        ↓
AI extracts reusable knowledge
        ↓
Creates Knowledge Proposal
        ↓
Human review
        ↓
Approve
        ↓
Knowledge Base
        ↓
Embedding/index update
        ↓
Future AI can retrieve it
`.trim();

export const KNOWLEDGE_PIPELINE: readonly KnowledgePipelineStageDefinition[] = [
  {
    stage: "customer_asks_question",
    label: "Customer asks question",
    description: "Inbound portal/ticket/chat question.",
    actors: ["customer"],
    tool: null,
    humanOnly: false,
  },
  {
    stage: "ai_answers",
    label: "AI answers",
    description: "Support/Knowledge AI answers using RAG + tools.",
    actors: ["support_ai", "knowledge_ai"],
    tool: "searchKnowledge",
    humanOnly: false,
  },
  {
    stage: "problem_resolved_gate",
    label: "Problem resolved?",
    description: "Gate: only YES continues to extraction. NO ends the capture path.",
    actors: ["customer", "support_ai", "human"],
    tool: null,
    humanOnly: false,
  },
  {
    stage: "extract_reusable_knowledge",
    label: "AI extracts reusable knowledge",
    description: "Strip PII and draft a reusable answer/runbook fragment.",
    actors: ["knowledge_ai", "support_ai"],
    tool: "extractReusableKnowledge",
    humanOnly: false,
  },
  {
    stage: "create_knowledge_proposal",
    label: "Creates Knowledge Proposal",
    description: "Create a draft Knowledge Proposal for staff review.",
    actors: ["knowledge_ai"],
    tool: "createKnowledgeProposal",
    humanOnly: false,
  },
  {
    stage: "human_review",
    label: "Human review",
    description: "Staff review accuracy, scope, and visibility.",
    actors: ["human"],
    tool: null,
    humanOnly: true,
  },
  {
    stage: "approve",
    label: "Approve",
    description: "Staff approve the proposal for the knowledge base.",
    actors: ["human"],
    tool: "approveKnowledgeProposal",
    humanOnly: true,
  },
  {
    stage: "knowledge_base",
    label: "Knowledge Base",
    description: "Publish approved content as article/revision/document.",
    actors: ["system"],
    tool: "publishKnowledgeProposal",
    humanOnly: false,
  },
  {
    stage: "embedding_index_update",
    label: "Embedding/index update",
    description: "Chunk, embed, and upsert VectorStore / KnowledgeChunk rows.",
    actors: ["system"],
    tool: "updateKnowledgeEmbeddings",
    humanOnly: false,
  },
  {
    stage: "future_retrieval",
    label: "Future AI can retrieve it",
    description: "Published chunks become searchable via searchKnowledge.",
    actors: ["support_ai", "knowledge_ai", "system"],
    tool: "searchKnowledge",
    humanOnly: false,
  },
] as const;

export function isKnowledgePipelineStage(value: string): value is KnowledgePipelineStage {
  return (KNOWLEDGE_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function getKnowledgePipelineStage(
  stage: KnowledgePipelineStage,
): KnowledgePipelineStageDefinition {
  const found = KNOWLEDGE_PIPELINE.find((item) => item.stage === stage);
  if (!found) {
    throw new Error(`Unknown knowledge pipeline stage: ${stage}`);
  }
  return found;
}

export function getNextKnowledgePipelineStage(
  stage: KnowledgePipelineStage,
): KnowledgePipelineStage | null {
  const index = KNOWLEDGE_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= KNOWLEDGE_PIPELINE_STAGES.length - 1) return null;
  return KNOWLEDGE_PIPELINE_STAGES[index + 1] ?? null;
}

/**
 * After the resolved gate: YES continues to extract; NO stops capture.
 */
export function continueKnowledgeCapture(resolved: boolean): KnowledgePipelineStage | null {
  return resolved ? "extract_reusable_knowledge" : null;
}

export function canKnowledgeAiActAtStage(stage: KnowledgePipelineStage): boolean {
  return !getKnowledgePipelineStage(stage).humanOnly;
}
