/** Auth package — session/JWT helpers and shared auth types. */
export type SessionUser = {
  id: string;
  email: string;
  role: "customer" | "admin" | "employee";
};

export type AuthTokenPayload = {
  sub: string;
  email: string;
  role: SessionUser["role"];
};

export function isAdminRole(role: SessionUser["role"]): boolean {
  return role === "admin" || role === "employee";
}
