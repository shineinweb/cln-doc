import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { GeneralSettings, MetrcApiInput, OpenAiApiInput, SessionUser, SettingsView } from '@trim/contracts';
import { loadEnv } from '../env';
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
      include: { metrcApiSetting: true, openAiApiSetting: true },
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

  async saveOpenAi(user: SessionUser, input: OpenAiApiInput): Promise<SettingsView> {
    this.assertManager(user);
    const existing = await this.prisma.openAiApiSetting.findUnique({
      where: { organizationId: user.organizationId },
    });
    const apiKey = input.apiKey || existing?.apiKey || '';
    if (!apiKey && !loadEnv().OPENAI_API_KEY) {
      throw new BadRequestException('Enter an OpenAI API key for Serenity, or set OPENAI_API_KEY on the server.');
    }
    const model = (input.model || existing?.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini';
    if (apiKey) {
      await this.prisma.openAiApiSetting.upsert({
        where: { organizationId: user.organizationId },
        create: {
          organizationId: user.organizationId,
          apiKey,
          model,
        },
        update: {
          apiKey,
          model,
        },
      });
    } else if (existing) {
      await this.prisma.openAiApiSetting.update({
        where: { organizationId: user.organizationId },
        data: { model },
      });
    }
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
      include: { metrcApiSetting: true, openAiApiSetting: true },
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
    openAiApiSetting: { apiKey: string; model: string } | null;
  }): SettingsView {
    const metrc = organization.metrcApiSetting;
    const openai = organization.openAiApiSetting;
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
      openai: {
        apiKeySaved: Boolean(openai?.apiKey),
        model: openai?.model || loadEnv().OPENAI_MODEL || 'gpt-4o-mini',
        envFallback: Boolean(loadEnv().OPENAI_API_KEY) && !openai?.apiKey,
      },
    };
  }
}
