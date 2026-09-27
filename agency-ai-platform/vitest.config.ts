import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@agency/shared": path.resolve(root, "packages/shared/src"),
      "@agency/ui": path.resolve(root, "packages/ui/src"),
      "@agency/database": path.resolve(root, "packages/database/src"),
      "@agency/auth": path.resolve(root, "packages/auth/src"),
      "@agency/ai": path.resolve(root, "packages/ai/src"),
      "@agency/billing": path.resolve(root, "packages/billing/src"),
      "@agency/hosting": path.resolve(root, "packages/hosting/src"),
      "@agency/domains": path.resolve(root, "packages/domains/src"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: [
      "packages/*/src/**/*.{test,spec}.ts",
      "packages/*/src/**/*.{test,spec}.tsx",
      "apps/*/src/**/*.{test,spec}.ts",
      "apps/*/src/**/*.{test,spec}.tsx",
    ],
    passWithNoTests: false,
  },
});
