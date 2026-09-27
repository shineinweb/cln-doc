import type { AuthUserView } from "./types";

export type AuthClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

async function request<T>(
  options: AuthClientOptions,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    detail?: string;
    title?: string;
  };

  if (!response.ok) {
    throw new Error(body.detail || body.title || `Request failed (${response.status})`);
  }

  return (body.data ?? body) as T;
}

/** Browser auth API — uses cookie session; never touches localStorage. */
export function createAuthClient(options: AuthClientOptions) {
  return {
    register(input: { email: string; password: string; name: string; organizationName: string }) {
      return request<AuthUserView>(options, "/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    login(input: { email: string; password: string }) {
      return request<AuthUserView>(options, "/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    logout() {
      return request<{ ok: true }>(options, "/auth/logout", { method: "POST" });
    },
    me() {
      return request<AuthUserView>(options, "/auth/me", { method: "GET" });
    },
    forgotPassword(input: { email: string }) {
      return request<{ ok: true }>(options, "/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    resetPassword(input: { token: string; password: string }) {
      return request<{ ok: true }>(options, "/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    verifyEmail(input: { token: string }) {
      return request<{ ok: true }>(options, "/auth/verify-email", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
  };
}

export type { AuthUserView, AuthMembership } from "./types";
