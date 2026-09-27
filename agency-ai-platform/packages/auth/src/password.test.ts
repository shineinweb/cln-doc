import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordPolicyValid, verifyPassword } from "./password";

describe("password hashing (argon2id)", () => {
  it("hashes and verifies passwords", async () => {
    const password = "Correct-Horse-Battery-1";
    const hashed = await hashPassword(password);
    expect(hashed).not.toEqual(password);
    expect(hashed.startsWith("$argon2")).toBe(true);
    await expect(verifyPassword(hashed, password)).resolves.toBe(true);
    await expect(verifyPassword(hashed, "wrong-password")).resolves.toBe(false);
  });

  it("enforces password policy length", () => {
    expect(isPasswordPolicyValid("short")).toBe(false);
    expect(isPasswordPolicyValid("long-enough-password")).toBe(true);
  });
});
