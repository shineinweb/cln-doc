import { describe, expect, it } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { StaffGuard } from "./staff.guard";

describe("StaffGuard", () => {
  it("customer cannot access admin APIs", () => {
    const guard = new StaffGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            sessionId: "sess_1",
            user: {
              id: "user_customer",
              isStaff: false,
              permissions: ["ai.use"],
              roles: ["customer"],
            },
          },
        }),
      }),
    } as never;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows staff users", () => {
    const guard = new StaffGuard();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          auth: {
            sessionId: "sess_2",
            user: {
              id: "user_staff",
              isStaff: true,
              permissions: ["customers.view"],
              roles: ["support_agent"],
            },
          },
        }),
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });
});
