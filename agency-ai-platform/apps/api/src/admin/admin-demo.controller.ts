import { Controller, Get } from "@nestjs/common";
import { Permissions } from "../common/decorators/permissions.decorator";

/** Minimal admin route to exercise permission guards. */
@Controller("admin")
export class AdminDemoController {
  @Get("ping")
  @Permissions("audit.read")
  ping() {
    return { data: { ok: true, scope: "admin" } };
  }
}
