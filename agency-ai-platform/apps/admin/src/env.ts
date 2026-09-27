import { loadWebEnv } from "@agency/shared";

/** Validated public Vite env — safe to expose to the browser. */
export const webEnv = loadWebEnv({
  VITE_API_URL: import.meta.env.VITE_API_URL,
});
