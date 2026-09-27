import { describe, expect, it } from "vitest";
import { getPlan, PLANS } from "./index";

describe("billing plans", () => {
  it("lists catalog plans", () => {
    expect(PLANS.length).toBeGreaterThan(0);
  });

  it("resolves a known plan", () => {
    expect(getPlan("starter")?.monthlyCents).toBe(9900);
  });
});
