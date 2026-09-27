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
          Agency AI · {APP_NAMES.clientPortal}
        </p>
        <h1 className="brand">Client Portal</h1>
        <p className="lede">
          Customers manage projects, billing, hosting, and domains in one place.
        </p>
        <div className="actions">
          <Button>Open dashboard</Button>
          <Button variant="ghost">Billing</Button>
        </div>
      </section>
    </main>
  );
}
