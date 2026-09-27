import { Link } from "react-router-dom";
import { COMPANY, NAV_PRIMARY, SERVICES } from "@/data/placeholders";
import { Container } from "@/components/ui/Container";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--border)]">
      <Container className="grid gap-10 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold">{COMPANY.name}</p>
          <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">{COMPANY.tagline}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.12em] uppercase">Explore</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {NAV_PRIMARY.slice(0, 6).map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="text-muted hover:text-[var(--fg)]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.12em] uppercase">Services</p>
          <ul className="mt-3 grid gap-2 text-sm">
            {SERVICES.map((service) => (
              <li key={service.slug}>
                <Link to={service.path} className="text-muted hover:text-[var(--fg)]">
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <div className="border-t border-[var(--border)]">
        <Container className="text-muted flex flex-col gap-2 py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </p>
          <p>
            {COMPANY.email} · {COMPANY.phone}
          </p>
        </Container>
      </div>
    </footer>
  );
}
