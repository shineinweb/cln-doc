import { Link } from "react-router-dom";
import type { ReactNode } from "react";

type Variant = "primary" | "ghost" | "inverse";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-strong)] border-transparent",
  ghost:
    "bg-transparent text-[var(--fg)] border-[var(--border)] hover:border-[var(--color-accent)]",
  inverse: "bg-white text-[var(--color-ink)] border-transparent hover:bg-[var(--color-paper)]",
};

export function ButtonLink({
  to,
  children,
  variant = "primary",
  className = "",
}: {
  to: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold no-underline transition-colors duration-200 ${variants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
