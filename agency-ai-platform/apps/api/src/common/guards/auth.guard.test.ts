import { describe, expect, it, vi } from "vitest";
import { UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SESSION_COOKIE_NAME } from "@agency/auth";
import { AuthGuard } from "./auth.guard";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

describe("AuthGuard", () => {
  it("rejects invalid authentication sessions", async () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === IS_PUBLIC_KEY ? false : undefined),
    } as unknown as Reflector;
    const authService = {
      resolveSession: vi.fn(async () => null),
    };
    const guard = new AuthGuard(reflector, authService as never);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          cookies: { [SESSION_COOKIE_NAME]: "expired-or-forged-token" },
        }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.resolveSession).toHaveBeenCalledWith("expired-or-forged-token");
  });

  it("rejects missing session on protected routes", async () => {
    const reflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const authService = { resolveSession: vi.fn() };
    const guard = new AuthGuard(reflector, authService as never);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }),
      }),
    } as never;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.resolveSession).not.toHaveBeenCalled();
  });
});
