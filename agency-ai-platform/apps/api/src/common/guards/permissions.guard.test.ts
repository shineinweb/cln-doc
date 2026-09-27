import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

describe("PermissionsGuard", () => {
  it("allows when no permissions metadata is set", () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as never;
    expect(guard.canActivate(context)).toBe(true);
  });

  it("denies when required permissions are missing", () => {
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
          auth: { user: { permissions: ["projects.view"] } },
        }),
      }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
