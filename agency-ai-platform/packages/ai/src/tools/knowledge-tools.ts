/**
 * Knowledge AI tool surface — capture proposals + indexing (no silent publish).
 * Human review/approve required before Knowledge Base + embeddings update.
 */

import type { AiToolDefinition } from "./types";

/** Includes shared `searchKnowledge` (defined on Customer Support tools). */
export const KNOWLEDGE_TOOL_NAMES = [
  "searchKnowledge",
  "extractReusableKnowledge",
  "createKnowledgeProposal",
  "approveKnowledgeProposal",
  "publishKnowledgeProposal",
  "updateKnowledgeEmbeddings",
] as const;

export type KnowledgeToolName = (typeof KNOWLEDGE_TOOL_NAMES)[number];

/** Knowledge-specific tools only (searchKnowledge lives in customer-support-tools). */
export const KNOWLEDGE_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "extractReusableKnowledge",
    description:
      "From a resolved conversation, extract a reusable, de-identified knowledge draft.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      conversationId: {
        type: "string",
        description: "Source AI conversation or ticket thread id.",
        required: true,
      },
      summaryHint: {
        type: "string",
        description: "Optional hint for what reusable fact to capture.",
        required: false,
      },
    },
  },
  {
    name: "createKnowledgeProposal",
    description:
      "Create a Knowledge Proposal (draft) for human review — not published yet.",
    risk: "write",
    requiresApproval: false,
    parameters: {
      title: {
        type: "string",
        description: "Proposed article title.",
        required: true,
      },
      body: {
        type: "string",
        description: "Proposed article body (markdown/text).",
        required: true,
      },
      visibility: {
        type: "string",
        description: "PUBLIC, INTERNAL, or BOTH.",
        required: false,
      },
      categoryId: {
        type: "string",
        description: "Optional KnowledgeCategory id.",
        required: false,
      },
      sourceConversationId: {
        type: "string",
        description: "Conversation/ticket that produced this proposal.",
        required: false,
      },
    },
  },
  {
    name: "approveKnowledgeProposal",
    description: "Staff approve a Knowledge Proposal after human review.",
    risk: "write",
    requiresApproval: true,
    parameters: {
      proposalId: {
        type: "string",
        description: "Knowledge Proposal id.",
        required: true,
      },
      note: {
        type: "string",
        description: "Optional reviewer note.",
        required: false,
      },
    },
  },
  {
    name: "publishKnowledgeProposal",
    description:
      "Publish an approved proposal into the Knowledge Base (article/revision).",
    risk: "write",
    requiresApproval: true,
    parameters: {
      proposalId: {
        type: "string",
        description: "Approved Knowledge Proposal id.",
        required: true,
      },
    },
  },
  {
    name: "updateKnowledgeEmbeddings",
    description:
      "Chunk published knowledge and upsert embeddings/index (MariaDB VectorStore).",
    risk: "write",
    requiresApproval: false,
    parameters: {
      sourceType: {
        type: "string",
        description: "article | document",
        required: true,
      },
      sourceId: {
        type: "string",
        description: "Published article or document id.",
        required: true,
      },
    },
  },
] as const;
