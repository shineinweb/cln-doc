export const SESSION_COOKIE_NAME = "agency_session";

export type SessionCookieOptions = {
  maxAgeMs: number;
  secure: boolean;
  domain?: string;
};

export function buildSessionCookieOptions(options: SessionCookieOptions) {
  return {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(options.maxAgeMs / 1000),
    ...(options.domain ? { domain: options.domain } : {}),
  };
}
