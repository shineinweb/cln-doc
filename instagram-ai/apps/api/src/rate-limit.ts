const buckets = new Map<string, number[]>()

export function hitLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (buckets.get(key) ?? []).filter((time) => now - time < windowMs)
  if (recent.length >= limit) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  return true
}

export function resetRateLimits(): void {
  buckets.clear()
}
