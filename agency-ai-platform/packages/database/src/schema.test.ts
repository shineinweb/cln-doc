import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

describe("Prisma MariaDB schema", () => {
  const schema = readFileSync(schemaPath, "utf8");

  it("uses mysql provider and DATABASE_URL", () => {
    expect(schema).toMatch(/datasource\s+db\s*\{[^}]*provider\s*=\s*"mysql"/s);
    expect(schema).toMatch(/url\s*=\s*env\("DATABASE_URL"\)/);
    expect(schema).not.toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).not.toMatch(/pgvector/i);
  });

  it("declares the Phase 1 identity models", () => {
    for (const model of [
      "User",
      "Session",
      "Organization",
      "OrganizationMember",
      "Role",
      "Permission",
      "RolePermission",
      "Customer",
      "CustomerContact",
      "AuditLog",
      "AuthToken",
      "UserRole",
    ]) {
      expect(schema).toContain(`model ${model}`);
    }
  });

  it("exposes generated model delegates on Prisma client DMMF", () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);
    expect(modelNames).toEqual(
      expect.arrayContaining([
        "User",
        "Session",
        "Organization",
        "OrganizationMember",
        "Role",
        "Permission",
        "RolePermission",
        "Customer",
        "CustomerContact",
        "AuditLog",
        "AuthToken",
        "UserRole",
      ]),
    );
  });
});
