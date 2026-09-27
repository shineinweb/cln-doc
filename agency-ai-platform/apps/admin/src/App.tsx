import { Button, tokens } from "@agency/ui";
import { APP_NAMES } from "@agency/shared";

export function App() {
  return (
    <main className="shell">
      <section className="panel">
        <p
          style={{
            margin: "0 0 0.35rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.75rem",
            color: tokens.color.accent,
            animation: "rise 700ms ease both",
          }}
        >
          Agency AI · {APP_NAMES.admin}
        </p>
        <h1 className="brand">Admin Console</h1>
        <p className="lede">
          Internal tools for employees — clients, ops, AI, and platform control.
        </p>
        <div className="actions">
          <Button>Enter admin</Button>
          <Button variant="ghost">System health</Button>
        </div>
      </section>
    </main>
  );
}
