const GIB = 1024 ** 3;

/** Format bytes as whole/one-decimal GiB labeled "GB" (common hosting UI convention). */
export function formatBytesAsGb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 GB";
  }
  const gib = bytes / GIB;
  const rounded = Math.abs(gib - Math.round(gib)) < 1e-9 ? Math.round(gib) : Math.round(gib * 10) / 10;
  return `${rounded} GB`;
}

export function formatUsagePair(usedBytes: number, limitBytes: number | null): string {
  const used = formatBytesAsGb(usedBytes);
  if (limitBytes === null) {
    return `${used} / Unlimited`;
  }
  return `${used} / ${formatBytesAsGb(limitBytes)}`;
}

/** 0–100 usage percentage; null limit → 0 (unknown ceiling). */
export function usagePercent(usedBytes: number, limitBytes: number | null): number {
  if (limitBytes === null || limitBytes <= 0) return 0;
  const raw = (usedBytes / limitBytes) * 100;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}
