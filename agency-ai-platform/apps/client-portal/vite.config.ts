import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@agency/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@agency/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@agency/hosting": path.resolve(__dirname, "../../packages/hosting/src"),
      "@agency/auth/browser": path.resolve(__dirname, "../../packages/auth/src/browser.ts"),
    },
  },
  server: {
    host: true,
  },
});
