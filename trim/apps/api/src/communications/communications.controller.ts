import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  emailBroadcastInputSchema,
  emailBroadcastListSchema,
  emailBroadcastSchema,
  type SessionUser,
} from '@trim/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CommunicationsService } from './communications.service';

@Controller('communications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('broadcasts')
  @RequirePermissions('communications.manage')
  async list(@CurrentUser() user: SessionUser) {
    return emailBroadcastListSchema.parse(await this.communications.list(user));
  }

  @Post('broadcasts')
  @RequirePermissions('communications.manage')
  async send(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(emailBroadcastInputSchema)) body: ReturnType<typeof emailBroadcastInputSchema.parse>,
  ) {
    return emailBroadcastSchema.parse(await this.communications.sendBroadcast(user, body));
  }
}
