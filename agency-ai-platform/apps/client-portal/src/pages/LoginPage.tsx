import { type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@agency/ui";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, error, login, enterDemoSession, clearError } = useAuth();

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
    } catch {
      /* error surfaced via AuthContext */
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <h1 className="brand">Client Portal</h1>
        <p className="lede">Sign in with your customer account.</p>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
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
            <Button type="submit">Log in</Button>
            <Button type="button" variant="ghost" onClick={enterDemoSession}>
              Continue with demo
            </Button>
          </div>
          <p className="auth-demo-note">
            Demo session is a development placeholder for portal UI — it does not create a
            server session.
          </p>
        </form>
      </section>
    </main>
  );
}
