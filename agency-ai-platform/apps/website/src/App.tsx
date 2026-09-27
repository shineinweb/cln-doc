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
          Agency AI · {APP_NAMES.website}
        </p>
        <h1 className="brand">Agency AI</h1>
        <p className="lede">
          Public site for the agency platform — marketing, leads, and product story.
        </p>
        <div className="actions">
          <Button>Get started</Button>
          <Button variant="ghost">View docs</Button>
        </div>
      </section>
    </main>
  );
}
