import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { loginRequestSchema, type LoginResponse, type SessionUser } from '@trim/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: ReturnType<typeof loginRequestSchema.parse>,
  ): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
