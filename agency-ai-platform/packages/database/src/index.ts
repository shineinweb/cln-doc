/** Database package — Prisma client & schema will live here. */
export type DatabaseClient = {
  ready: boolean;
};

export function createDatabaseClient(): DatabaseClient {
  return { ready: false };
}
