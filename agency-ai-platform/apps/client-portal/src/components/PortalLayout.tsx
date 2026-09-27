import { NavLink, Navigate, Outlet } from "react-router-dom";
import { Button } from "@agency/ui";
import { useAuth } from "../auth/AuthContext";
import { PORTAL_NAV } from "../data/placeholders";

export function PortalLayout() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <main className="shell">
        <p className="lede">Loading session…</p>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="portal-shell">
      <header className="portal-top">
        <div className="portal-top__brand">
          <p className="portal-top__product">Agency Portal</p>
          <p className="portal-top__user">{user.name}</p>
        </div>
        <nav className="portal-nav" aria-label="Portal">
          {PORTAL_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "portal-nav__link portal-nav__link--active" : "portal-nav__link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button type="button" variant="ghost" onClick={() => void logout()}>
          Log out
        </Button>
      </header>
      <main className="portal-main">
        <Outlet />
      </main>
    </div>
  );
}
