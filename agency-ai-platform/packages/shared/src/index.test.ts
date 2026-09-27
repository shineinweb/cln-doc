import { describe, expect, it } from "vitest";
import { APP_NAMES, assertNever } from "./index";

describe("APP_NAMES", () => {
  it("exposes stable app identifiers", () => {
    expect(APP_NAMES.api).toBe("api");
    expect(APP_NAMES.website).toBe("website");
  });
});

describe("assertNever", () => {
  it("throws for exhaustive-check failures", () => {
    expect(() => assertNever("x" as never)).toThrow(/Unexpected value/);
  });
});
