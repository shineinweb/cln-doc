import { PLACEHOLDER_NOTICE } from "@/data/placeholders";

export function PlaceholderBadge({ className = "" }: { className?: string }) {
  return (
    <p
      className={`text-muted inline-flex rounded-md border border-dashed border-[var(--border)] px-2 py-1 text-xs ${className}`}
      role="note"
    >
      {PLACEHOLDER_NOTICE}
    </p>
  );
}
