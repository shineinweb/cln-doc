export function StatusPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-md bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] px-2 py-0.5 text-xs font-semibold tracking-wide text-[var(--color-accent)] uppercase">
      {label.replaceAll("_", " ")}
    </span>
  );
}
