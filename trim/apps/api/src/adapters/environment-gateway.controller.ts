import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  environmentalReadingSchema,
  gatewayReadingSchema,
  sensorGatewaySchema,
  type EnvironmentalReading,
  type GatewayReading,
  type SensorGateway,
  type SessionUser,
} from '@trim/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { EnvironmentGatewayService } from './environment-gateway.service';

@Controller('adapters/environment')
@UseGuards(JwtAuthGuard)
export class EnvironmentGatewayController {
  constructor(private readonly gateways: EnvironmentGatewayService) {}

  @Get('gateways/:gatewayId')
  async getGateway(@CurrentUser() user: SessionUser, @Param('gatewayId') gatewayId: string): Promise<SensorGateway> {
    return sensorGatewaySchema.parse(await this.gateways.getGateway(user, gatewayId));
  }

  @Get('sites/:siteId/gateway')
  async gatewayForSite(@CurrentUser() user: SessionUser, @Param('siteId') siteId: string): Promise<SensorGateway> {
    return sensorGatewaySchema.parse(await this.gateways.gatewayForSite(user, siteId));
  }

  @Post('gateways/:gatewayId/readings')
  async postReading(
    @CurrentUser() user: SessionUser,
    @Param('gatewayId') gatewayId: string,
    @Body(new ZodValidationPipe(gatewayReadingSchema)) body: GatewayReading,
  ): Promise<EnvironmentalReading> {
    return environmentalReadingSchema.parse(await this.gateways.postReading(user, gatewayId, body));
  }
}
