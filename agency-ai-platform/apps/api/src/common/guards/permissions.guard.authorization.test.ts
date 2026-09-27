import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { permissionsForPlatformRole } from "@agency/auth";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

describe("authorization API — PermissionsGuard", () => {
  it("employee without billing.refund cannot issue refunds", () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PERMISSIONS_KEY ? ["billing.refund"] : undefined,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    const supportContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            user: {
              permissions: permissionsForPlatformRole("support_agent"),
              isStaff: true,
            },
          },
        }),
      }),
    } as never;

    expect(() => guard.canActivate(supportContext)).toThrow(ForbiddenException);

    const billingContext = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            user: {
              permissions: permissionsForPlatformRole("billing"),
              isStaff: true,
            },
          },
        }),
      }),
    } as never;

    expect(guard.canActivate(billingContext)).toBe(true);
  });

  it("customer cannot satisfy admin permission checks", () => {
    const reflector = {
      getAllAndOverride: (key: string) =>
        key === PERMISSIONS_KEY ? ["customers.view"] : undefined,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            user: {
              permissions: permissionsForPlatformRole("customer"),
              isStaff: false,
            },
          },
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
