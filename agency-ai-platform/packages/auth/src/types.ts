export type AuthMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export type AuthUserView = {
  id: string;
  email: string;
  name: string;
  isStaff: boolean;
  emailVerified: boolean;
  memberships: AuthMembership[];
  permissions: string[];
  roles: string[];
};

export type RequestAuthContext = {
  user: AuthUserView;
  sessionId: string;
};
