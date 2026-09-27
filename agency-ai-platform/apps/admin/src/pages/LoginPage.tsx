import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/admin";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      void navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (API must be running for staff login.)`
          : "Login failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(900px_480px_at_10%_-10%,#ccfbf1,transparent_55%),radial-gradient(700px_400px_at_100%_0%,#e0f2fe,transparent_50%),var(--bg)] px-4">
      <section className="surface animate-rise w-full max-w-md rounded-2xl p-6 sm:p-8">
        <p className="font-display text-2xl font-bold">Agency AI Admin</p>
        <p className="text-muted mt-2 text-sm">Staff login with RBAC-backed permissions.</p>
        <form className="mt-6 grid gap-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="grid gap-2 text-sm font-semibold">
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="username"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Password
            <input
              required
              type="password"
              name="password"
              minLength={10}
              autoComplete="current-password"
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 font-normal"
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Enter admin"}
          </button>
        </form>
        <p className="text-muted mt-4 text-xs">
          Or{" "}
          <Link to="/admin/leads" className="font-semibold text-[var(--color-accent)]">
            browse CRM placeholders
          </Link>{" "}
          without a session (development only).
        </p>
      </section>
    </div>
  );
}
