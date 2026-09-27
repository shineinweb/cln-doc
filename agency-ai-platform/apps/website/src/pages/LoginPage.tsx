import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { createAuthClient, type AuthUserView } from "@agency/auth/browser";
import { PageMeta } from "@/components/seo/PageMeta";
import { PageHero } from "@/components/marketing/PageHero";
import { Container } from "@/components/ui/Container";
import { PlaceholderBadge } from "@/components/ui/PlaceholderBadge";
import { webEnv } from "@/env";

const auth = createAuthClient({ baseUrl: webEnv.VITE_API_URL });

export function LoginPage() {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const next = await auth.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      setUser(next);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} (API must be running for real login.)`
          : "Login failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageMeta title="Login" description="Customer login for Agency AI." path="/login" />
      <PageHero
        eyebrow="Login"
        title="Access your customer portal."
        description="Uses secure HttpOnly session cookies via the API — tokens are never stored in localStorage."
      />
      <Container className="py-12">
        <PlaceholderBadge />
        {user ? (
          <div className="surface mt-6 max-w-md rounded-2xl p-6">
            <p className="font-display text-2xl font-bold">Signed in</p>
            <p className="text-muted mt-2 text-sm">
              {user.name} · {user.email}
            </p>
            <button
              type="button"
              className="mt-5 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
              onClick={() => void auth.logout().then(() => setUser(null))}
            >
              Log out
            </button>
          </div>
        ) : (
          <form
            onSubmit={(event) => void onSubmit(event)}
            className="surface mt-6 grid max-w-md gap-4 rounded-2xl p-6"
          >
            <label className="grid gap-2 text-sm font-semibold">
              Email
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
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
              {pending ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-muted text-xs">
              Need an account?{" "}
              <Link to="/request-quote" className="font-semibold text-[var(--color-accent)]">
                Request a quote
              </Link>{" "}
              or register via the API when public signup is enabled in your environment.
            </p>
          </form>
        )}
      </Container>
    </>
  );
}
