import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import {
  generalSettingsSchema,
  metrcApiInputSchema,
  settingsViewSchema,
  type GeneralSettings,
  type MetrcApiInput,
  type SessionUser,
  type SettingsView,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('settings.manage')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get(@CurrentUser() user: SessionUser): Promise<SettingsView> {
    return settingsViewSchema.parse(await this.settings.get(user));
  }

  @Patch('general')
  async saveGeneral(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(generalSettingsSchema)) body: GeneralSettings,
  ): Promise<SettingsView> {
    return settingsViewSchema.parse(await this.settings.saveGeneral(user, body));
  }

  @Post('metrc')
  async saveMetrc(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(metrcApiInputSchema)) body: MetrcApiInput,
  ): Promise<SettingsView> {
    return settingsViewSchema.parse(await this.settings.saveMetrc(user, body));
  }
}
