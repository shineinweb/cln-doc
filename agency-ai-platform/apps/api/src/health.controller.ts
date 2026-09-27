import { Controller, Get } from "@nestjs/common";
import type { ApiHealth } from "@agency/shared";

@Controller("health")
export class HealthController {
  @Get()
  health(): ApiHealth {
    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    };
  }
}
