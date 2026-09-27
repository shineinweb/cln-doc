import { NavLink } from "react-router-dom";
import { ADMIN_NAV } from "@/data/placeholders";
import { useAuth } from "@/auth/AuthContext";

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-label="Close navigation"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[var(--color-sidebar)] text-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-xl font-bold tracking-tight">Agency AI</p>
          <p className="mt-1 text-xs text-white/60">Admin Console</p>
        </div>
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 p-3">
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4 text-sm">
          {user ? (
            <>
              <p className="font-semibold">{user.name}</p>
              <p className="mt-1 truncate text-xs text-white/60">{user.email}</p>
              <button
                type="button"
                className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                onClick={() => void logout()}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink
              to="/admin/login"
              onClick={onClose}
              className="text-xs font-semibold text-[var(--color-accent-strong)] no-underline hover:underline"
            >
              Staff login
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}
