import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { COMPANY, NAV_PRIMARY } from "@/data/placeholders";
import { ThemeToggle } from "./ThemeToggle";
import type { ThemeMode } from "@/hooks/useTheme";
import { ButtonLink } from "@/components/ui/ButtonLink";

export function SiteHeader({
  theme,
  onToggleTheme,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="font-display text-lg font-extrabold tracking-tight text-[var(--fg)] no-underline"
        >
          {COMPANY.name}
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_PRIMARY.slice(0, 6).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-2.5 py-1.5 text-sm font-medium no-underline transition-colors ${
                  isActive
                    ? "text-[var(--color-accent-strong)] dark:text-[var(--color-accent-glow)]"
                    : "text-muted hover:text-[var(--fg)]"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <ButtonLink to="/login" variant="ghost" className="hidden sm:inline-flex">
            Login
          </ButtonLink>
          <ButtonLink to="/request-quote" className="hidden sm:inline-flex">
            Request quote
          </ButtonLink>
          <button
            type="button"
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-[var(--border)] lg:hidden">
          <nav aria-label="Mobile" className="mx-auto grid max-w-6xl gap-1 px-5 py-3 sm:px-6">
            {NAV_PRIMARY.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-[var(--fg)] no-underline"
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-medium no-underline"
            >
              Login
            </NavLink>
            <NavLink
              to="/request-quote"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2 text-sm font-semibold text-[var(--color-accent)] no-underline"
            >
              Request quote
            </NavLink>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
