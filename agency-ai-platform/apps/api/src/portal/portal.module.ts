import { Module } from "@nestjs/common";
import { PortalOrganizationsController } from "./portal-organizations.controller";

@Module({
  controllers: [PortalOrganizationsController],
})
export class PortalModule {}
