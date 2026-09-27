import { useState, type FormEvent } from "react";
import { Button } from "@agency/ui";
import { createAuthClient, type AuthUserView } from "@agency/auth/browser";
import { webEnv } from "./env";

const auth = createAuthClient({ baseUrl: webEnv.VITE_API_URL });

type Mode = "login" | "register" | "forgot";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    try {
      if (mode === "login") {
        const next = await auth.login({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        });
        setUser(next);
      } else if (mode === "register") {
        const next = await auth.register({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          name: String(form.get("name") ?? ""),
          organizationName: String(form.get("organizationName") ?? ""),
        });
        setUser(next);
        setMessage("Registered. Check email for verification token (dev inbox/logs).");
      } else {
        await auth.forgotPassword({ email: String(form.get("email") ?? "") });
        setMessage("If that email exists, a reset token was sent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await auth.logout();
    setUser(null);
  }

  if (user) {
    return (
      <section className="panel auth-panel">
        <h2 className="brand" style={{ fontSize: "1.8rem" }}>
          Signed in
        </h2>
        <p className="lede">
          {user.name} · {user.email}
          {user.emailVerified ? "" : " (email not verified)"}
        </p>
        <div className="actions">
          <Button type="button" onClick={() => void logout()}>
            Log out
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel auth-panel">
      <h2 className="brand" style={{ fontSize: "1.8rem" }}>
        {mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Forgot password"}
      </h2>
      <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
        {mode === "register" ? (
          <>
            <label>
              Name
              <input name="name" required maxLength={200} autoComplete="name" />
            </label>
            <label>
              Organization
              <input name="organizationName" required maxLength={200} />
            </label>
          </>
        ) : null}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        {mode !== "forgot" ? (
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
        ) : null}
        {error ? <p className="auth-error">{error}</p> : null}
        {message ? <p className="auth-message">{message}</p> : null}
        <div className="actions">
          <Button type="submit" disabled={pending}>
            {pending ? "Please wait…" : mode === "forgot" ? "Send reset" : "Continue"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Need an account?" : "Have an account?"}
          </Button>
          {mode === "login" ? (
            <Button type="button" variant="ghost" onClick={() => setMode("forgot")}>
              Forgot password
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
