/**
 * EmbeddingProvider — OpenAI embeddings (and future adapters).
 * Nest/AI Service only; never import vendor SDKs from React.
 */

export type EmbeddingRequest = {
  model: string;
  texts: string[];
};

export type EmbeddingResponse = {
  model: string;
  provider: string;
  vectors: number[][];
};

export interface EmbeddingProvider {
  readonly name: string;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}
