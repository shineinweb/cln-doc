import { Module } from "@nestjs/common";
import { InMemoryEmailProvider } from "@agency/auth";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EMAIL_PROVIDER } from "./auth.constants";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => new InMemoryEmailProvider(),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
