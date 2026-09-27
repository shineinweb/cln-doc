import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminDemoController } from "./admin/admin-demo.controller";
import { AiModule } from "./ai/ai.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BillingModule } from "./billing/billing.module";
import { ProblemDetailsFilter } from "./common/filters/problem-details.filter";
import { AuthGuard } from "./common/guards/auth.guard";
import { PermissionsGuard } from "./common/guards/permissions.guard";
import { StaffGuard } from "./common/guards/staff.guard";
import { HealthController } from "./health.controller";
import { PortalModule } from "./portal/portal.module";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    AuditModule,
    AuthModule,
    AiModule,
    BillingModule,
    PortalModule,
  ],
  controllers: [AppController, HealthController, AdminDemoController],
  providers: [
    AppService,
    StaffGuard,
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
