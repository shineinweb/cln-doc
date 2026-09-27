import { hash, verify } from "@node-rs/argon2";

/** Argon2id parameters suitable for interactive logins. */
const ARGON2_OPTIONS = {
  // 2 = Argon2id (@node-rs/argon2 Algorithm.Argon2id)
  algorithm: 2 as const,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

export function isPasswordPolicyValid(password: string): boolean {
  return password.length >= 10 && password.length <= 128;
}
