import { describe, expect, it } from "vitest";
import { EnvValidationError, loadApiEnv, loadWebEnv } from "./env";

describe("loadApiEnv", () => {
  it("applies defaults", () => {
    const env = loadApiEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
  });

  it("parses PORT from string", () => {
    const env = loadApiEnv({ PORT: "4000" });
    expect(env.PORT).toBe(4000);
  });

  it("rejects invalid PORT", () => {
    expect(() => loadApiEnv({ PORT: "0" })).toThrow(EnvValidationError);
  });
});

describe("loadWebEnv", () => {
  it("defaults API URL", () => {
    const env = loadWebEnv({});
    expect(env.VITE_API_URL).toBe("http://localhost:3000/api/v1");
  });

  it("rejects non-URL API URL", () => {
    expect(() => loadWebEnv({ VITE_API_URL: "not-a-url" })).toThrow(EnvValidationError);
  });
});
