import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { assertOrganizationAccess, OrganizationAccessError, type AuthUserView } from "@agency/auth";
import { CurrentUser } from "../common/decorators/current-user.decorator";

/**
 * Portal tenant-scoped resource. Customer A must not read Customer B.
 */
@Controller("portal/organizations")
export class PortalOrganizationsController {
  @Get(":organizationId")
  getOrganization(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    try {
      assertOrganizationAccess(user, organizationId);
    } catch (error) {
      if (error instanceof OrganizationAccessError) {
        // Do not leak existence of other tenants.
        throw new NotFoundException("Organization not found");
      }
      throw error;
    }

    return {
      data: {
        organizationId,
        name:
          user.memberships.find((membership) => membership.organizationId === organizationId)
            ?.organizationName ?? organizationId,
      },
    };
  }
}
