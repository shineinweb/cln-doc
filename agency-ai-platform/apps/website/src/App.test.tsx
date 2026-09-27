import { describe, expect, it } from "vitest";
import { NAV_PRIMARY, SERVICES } from "./data/placeholders";

describe("website placeholder catalog", () => {
  it("exposes primary navigation and services", () => {
    expect(NAV_PRIMARY.length).toBeGreaterThan(5);
    expect(SERVICES.some((service) => service.slug === "ai-development")).toBe(true);
  });
});
