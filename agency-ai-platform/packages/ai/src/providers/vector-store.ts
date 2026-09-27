/**
 * VectorStore — MariaDB-backed similarity search for RAG (v1).
 * No second SQL engine; chunks + embeddings live in KnowledgeChunk.
 */

export type VectorUpsert = {
  id: string;
  organizationId?: string;
  sourceType: "article" | "document" | "ticket" | "other";
  sourceId: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
};

export type VectorQuery = {
  embedding: number[];
  organizationId?: string;
  sourceTypes?: VectorUpsert["sourceType"][];
  limit?: number;
};

export type VectorMatch = {
  id: string;
  score: number;
  content: string;
  sourceType: string;
  sourceId: string;
};

export interface VectorStore {
  readonly name: string;
  upsert(chunks: VectorUpsert[]): Promise<void>;
  search(query: VectorQuery): Promise<VectorMatch[]>;
  deleteBySource(sourceType: string, sourceId: string): Promise<void>;
}
