import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { AdminSidebar } from "./AdminSidebar";

export function AdminLayout() {
  const { user, loading } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <AdminSidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 lg:hidden">
          <p className="font-display font-bold">Agency AI Admin</p>
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            Menu
          </button>
        </header>
        {!loading && !user ? (
          <div
            className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 sm:px-6 lg:px-8"
            role="status"
          >
            Staff session inactive — CRM tables show development placeholders.{" "}
            <Link to="/admin/login" className="font-semibold underline">
              Sign in
            </Link>{" "}
            when the API is available.
          </div>
        ) : null}
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
