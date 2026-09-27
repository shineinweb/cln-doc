/**
 * AI authorization — tools inherit the authenticated actor's permissions.
 * The model cannot escalate privileges or cross tenants.
 *
 * Intentionally does not import `@agency/auth` so React apps can bundle
 * `@agency/ai` catalog helpers without pulling Node auth/argon2.
 */

import type { AiToolInvokeContext } from "../tools/types";

export class AiAuthorizationError extends Error {
  readonly code: string;

  constructor(message: string, code = "AI_FORBIDDEN") {
    super(message);
    this.name = "AiAuthorizationError";
    this.code = code;
  }
}

export type AiActor = {
  userId: string;
  permissions: readonly string[];
  /** Organizations the actor may touch (from OrganizationMember). */
  membershipOrganizationIds: readonly string[];
  isStaff: boolean;
};

/** Structural user shape (compatible with AuthUserView). */
export type AiActorUser = {
  id: string;
  permissions: readonly string[];
  memberships: readonly { organizationId: string }[];
  isStaff: boolean;
};

export function aiActorFromUser(user: AiActorUser): AiActor {
  return {
    userId: user.id,
    permissions: user.permissions,
    membershipOrganizationIds: user.memberships.map((m) => m.organizationId),
    isStaff: user.isStaff,
  };
}

function actorHasPermission(granted: readonly string[], required: string): boolean {
  if (granted.includes(required)) {
    return true;
  }
  const [namespace] = required.split(".");
  return granted.includes(`${namespace}.*`) || granted.includes("*");
}

/**
 * AI cannot bypass authorization: actor must have ai.use, match ctx.userId,
 * and pass tenant isolation for the tool organizationId.
 */
export function assertAiActorAuthorized(actor: AiActor, ctx: AiToolInvokeContext): void {
  if (!actorHasPermission(actor.permissions, "ai.use")) {
    throw new AiAuthorizationError("AI actor lacks ai.use permission", "AI_USE_REQUIRED");
  }

  if (actor.userId !== ctx.userId) {
    throw new AiAuthorizationError(
      "AI cannot invoke tools as a different user",
      "AI_IMPERSONATION_DENIED",
    );
  }

  if (!actor.membershipOrganizationIds.includes(ctx.organizationId)) {
    throw new AiAuthorizationError(
      `AI cannot access organization ${ctx.organizationId}`,
      "AI_TENANT_DENIED",
    );
  }
}
