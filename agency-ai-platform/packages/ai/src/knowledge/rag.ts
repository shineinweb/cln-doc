/**
 * Knowledge / RAG helpers — chunking + retrieval orchestration.
 * PLACEHOLDER: VectorStore + KnowledgeChunk persistence wired in Phase 8.
 */

export type RagChunkInput = {
  sourceType: "article" | "document" | "ticket" | "other";
  sourceId: string;
  content: string;
  organizationId?: string;
};

export type RagSearchInput = {
  query: string;
  organizationId?: string;
  limit?: number;
};

export type RagSearchHit = {
  chunkId: string;
  score: number;
  content: string;
  sourceType: string;
  sourceId: string;
};

/** Naive whitespace chunker for local scaffolding only. */
export function chunkText(content: string, maxChars = 1200): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let offset = 0;
  while (offset < trimmed.length) {
    chunks.push(trimmed.slice(offset, offset + maxChars));
    offset += maxChars;
  }
  return chunks;
}

/**
 * PLACEHOLDER retrieval — returns empty until VectorStore is bound.
 * Nest/agents must inject a real VectorStore; do not invent remote search here.
 */
export async function searchKnowledge(_input: RagSearchInput): Promise<RagSearchHit[]> {
  return [];
}
