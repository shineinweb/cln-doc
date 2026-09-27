import { Outlet } from "react-router-dom";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { useTheme } from "@/hooks/useTheme";

export function SiteLayout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="bg-page min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[var(--bg-elevated)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} />
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
