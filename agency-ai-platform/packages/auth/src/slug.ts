import { randomBytes } from "node:crypto";

export function slugifyOrganizationName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  const suffix = randomBytes(3).toString("hex");
  return `${base || "org"}-${suffix}`;
}
