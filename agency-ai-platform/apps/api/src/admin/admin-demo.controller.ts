import { Controller, Get, UseGuards } from "@nestjs/common";
import { Permissions } from "../common/decorators/permissions.decorator";
import { StaffGuard } from "../common/guards/staff.guard";

/** Minimal admin route to exercise staff + permission guards. */
@Controller("admin")
@UseGuards(StaffGuard)
export class AdminDemoController {
  @Get("ping")
  @Permissions("customers.view")
  ping() {
    return { data: { ok: true, scope: "admin" } };
  }
}
