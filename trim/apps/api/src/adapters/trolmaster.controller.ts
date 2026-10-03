import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import {
  trolmasterConnectionSchema,
  trolmasterInputSchema,
  type SessionUser,
  type TrolmasterConnection,
  type TrolmasterInput,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TrolmasterService } from './trolmaster.service';

const trolmasterListSchema = z.array(trolmasterConnectionSchema);

@Controller('sites/:siteId/trolmaster')
@UseGuards(JwtAuthGuard)
export class TrolmasterController {
  constructor(private readonly trolmaster: TrolmasterService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<TrolmasterConnection[]> {
    return trolmasterListSchema.parse(await this.trolmaster.list(user, siteId));
  }

  @Post()
  async save(
    @CurrentUser() user: SessionUser,
    @Param('siteId') siteId: string,
    @Body(new ZodValidationPipe(trolmasterInputSchema)) body: TrolmasterInput,
  ): Promise<TrolmasterConnection> {
    return trolmasterConnectionSchema.parse(await this.trolmaster.save(user, siteId, body));
  }
}
