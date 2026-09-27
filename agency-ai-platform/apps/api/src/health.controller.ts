import { Controller, Get } from "@nestjs/common";
import type { ApiHealth } from "@agency/shared";
import { Public } from "./common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  health(): ApiHealth {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
  }
}
