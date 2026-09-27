import { NavLink } from "react-router-dom";
import { ADMIN_AI_SECTIONS } from "@agency/ai";

export function AiSubnav() {
  return (
    <nav
      aria-label="AI management"
      className="surface animate-rise flex flex-wrap gap-1 rounded-2xl p-2"
    >
      <NavLink
        to="/admin/ai"
        end
        className={({ isActive }) =>
          `rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition-colors ${
            isActive
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--fg-muted)] hover:bg-[var(--color-paper)] hover:text-[var(--fg)]"
          }`
        }
      >
        Overview
      </NavLink>
      {ADMIN_AI_SECTIONS.map((section) => (
        <NavLink
          key={section.key}
          to={`/admin/ai/${section.path}`}
          className={({ isActive }) =>
            `rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition-colors ${
              isActive
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--fg-muted)] hover:bg-[var(--color-paper)] hover:text-[var(--fg)]"
            }`
          }
        >
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
