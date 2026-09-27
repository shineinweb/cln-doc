import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@agency/ui";
import { createAuthClient, type AuthUserView } from "@agency/auth/browser";
import { webEnv } from "./env";

const auth = createAuthClient({ baseUrl: webEnv.VITE_API_URL });

export function AuthPanel() {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void auth
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const next = await auth.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (!next.isStaff) {
        await auth.logout();
        setError("Staff access required");
        setUser(null);
        return;
      }
      setUser(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (user) {
    return (
      <section className="panel">
        <h1 className="brand">Admin Console</h1>
        <p className="lede">
          {user.name} · roles: {user.roles.join(", ") || "none"}
        </p>
        <div className="actions">
          <Button type="button" onClick={() => void auth.logout().then(() => setUser(null))}>
            Log out
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1 className="brand">Admin Console</h1>
      <p className="lede">Staff login with RBAC-backed permissions.</p>
      <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="username" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="auth-error">{error}</p> : null}
        <div className="actions">
          <Button type="submit">Enter admin</Button>
        </div>
      </form>
    </section>
  );
}
