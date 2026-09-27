import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  agencyPrisma?: PrismaClient;
};

export type AgencyPrismaClient = PrismaClient;

export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** Process-wide Prisma client (safe for Nest/Vite Node tooling). */
export const prisma: PrismaClient = globalForPrisma.agencyPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.agencyPrisma = prisma;
}
