/**
 * Canonical knowledge / RAG domain for the Agency AI Platform.
 *
 * KnowledgeCategory → KnowledgeArticle → KnowledgeRevision
 * KnowledgeDocument → KnowledgeChunk (embeddings stored as JSON in MariaDB)
 */

export const KNOWLEDGE_DOMAIN_MODELS = [
  "KnowledgeArticle",
  "KnowledgeCategory",
  "KnowledgeDocument",
  "KnowledgeChunk",
  "KnowledgeRevision",
] as const;

export type KnowledgeDomainModel = (typeof KNOWLEDGE_DOMAIN_MODELS)[number];

export const KNOWLEDGE_ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export type KnowledgeArticleStatusValue = (typeof KNOWLEDGE_ARTICLE_STATUSES)[number];

export const KNOWLEDGE_VISIBILITIES = ["PUBLIC", "INTERNAL", "BOTH"] as const;

export type KnowledgeVisibilityValue = (typeof KNOWLEDGE_VISIBILITIES)[number];

export const KNOWLEDGE_DOCUMENT_STATUSES = ["PENDING", "PROCESSING", "READY", "FAILED"] as const;

export type KnowledgeDocumentStatusValue = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

export const KNOWLEDGE_ARTICLE_STATUS_PIPELINE = [
  { status: "DRAFT", label: "Draft", description: "Editable; not shown publicly." },
  {
    status: "PUBLISHED",
    label: "Published",
    description: "Live for the article visibility audience.",
  },
  { status: "ARCHIVED", label: "Archived", description: "Retained but hidden from default lists." },
] as const;

export function isKnowledgeArticleStatus(value: string): value is KnowledgeArticleStatusValue {
  return (KNOWLEDGE_ARTICLE_STATUSES as readonly string[]).includes(value);
}

export function isKnowledgeVisibility(value: string): value is KnowledgeVisibilityValue {
  return (KNOWLEDGE_VISIBILITIES as readonly string[]).includes(value);
}
