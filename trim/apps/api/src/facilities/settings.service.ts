import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { GeneralSettings, MetrcApiInput, SessionUser, SettingsView } from '@trim/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(user: SessionUser): Promise<SettingsView> {
    const organization = await this.organization(user);
    return this.toView(organization);
  }

  async saveGeneral(user: SessionUser, input: GeneralSettings): Promise<SettingsView> {
    this.assertManager(user);
    const organization = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: input.companyName,
        title: input.title || null,
        description: input.description || null,
      },
      include: { metrcApiSetting: true },
    });
    return this.toView(organization);
  }

  async saveMetrc(user: SessionUser, input: MetrcApiInput): Promise<SettingsView> {
    this.assertManager(user);
    const existing = await this.prisma.metrcApiSetting.findUnique({
      where: { organizationId: user.organizationId },
    });
    const integratorApiKey = input.integratorApiKey || existing?.integratorApiKey || '';
    const userApiKey = input.userApiKey || existing?.userApiKey || '';
    if (!integratorApiKey || !userApiKey) {
      throw new BadRequestException('Enter the integrator API key and the user API key.');
    }
    await this.prisma.metrcApiSetting.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        integratorApiKey,
        userApiKey,
        licenseNumber: input.licenseNumber,
      },
      update: {
        integratorApiKey,
        userApiKey,
        licenseNumber: input.licenseNumber,
      },
    });
    return this.get(user);
  }

  private assertManager(user: SessionUser) {
    if (user.isOrgAdmin || user.permissions.includes('settings.manage')) {
      return;
    }
    throw new ForbiddenException('You do not have permission for settings.manage.');
  }

  private async organization(user: SessionUser) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: { metrcApiSetting: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  private toView(organization: {
    name: string;
    title: string | null;
    description: string | null;
    metrcApiSetting: { integratorApiKey: string; userApiKey: string; licenseNumber: string } | null;
  }): SettingsView {
    const metrc = organization.metrcApiSetting;
    return {
      general: {
        companyName: organization.name,
        title: organization.title ?? '',
        description: organization.description ?? '',
      },
      metrc: {
        integratorKeySaved: Boolean(metrc?.integratorApiKey),
        userKeySaved: Boolean(metrc?.userApiKey),
        licenseNumber: metrc?.licenseNumber ?? '',
      },
    };
  }
}
