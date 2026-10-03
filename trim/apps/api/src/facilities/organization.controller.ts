import { Controller, Get, UseGuards } from '@nestjs/common';
import type { OrganizationSummary, SessionUser } from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FacilitiesService } from './facilities.service';

@Controller('organization')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly facilities: FacilitiesService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): Promise<OrganizationSummary> {
    return this.facilities.getOrganization(user);
  }
}
