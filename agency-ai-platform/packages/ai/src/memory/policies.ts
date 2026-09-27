/**
 * Memory read/write policies.
 * PLACEHOLDER: AiMemory persistence + retention jobs land with Phase 8.
 */

export type MemoryScope = "user" | "organization" | "conversation" | "global";

export type MemoryWritePolicy = {
  scope: MemoryScope;
  /** Max items retained per scope key before eviction. */
  maxItems: number;
  /** Days to retain; null = indefinite (subject to erasure jobs). */
  retentionDays: number | null;
  allowPii: boolean;
};

export const DEFAULT_MEMORY_POLICIES: readonly MemoryWritePolicy[] = [
  { scope: "conversation", maxItems: 50, retentionDays: 90, allowPii: false },
  { scope: "user", maxItems: 20, retentionDays: 365, allowPii: false },
  { scope: "organization", maxItems: 100, retentionDays: 365, allowPii: false },
  { scope: "global", maxItems: 200, retentionDays: null, allowPii: false },
] as const;

export function getMemoryPolicy(scope: MemoryScope): MemoryWritePolicy {
  const policy = DEFAULT_MEMORY_POLICIES.find((item) => item.scope === scope);
  if (!policy) {
    throw new Error(`Unknown memory scope: ${scope}`);
  }
  return policy;
}
