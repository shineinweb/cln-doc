import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
  type ForgotPasswordResponse,
  type LoginResponse,
  type ResetPasswordResponse,
  type SessionUser,
} from '@trim/contracts';
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

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ReturnType<typeof forgotPasswordRequestSchema.parse>,
  ): Promise<ForgotPasswordResponse> {
    return this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema)) body: ReturnType<typeof resetPasswordRequestSchema.parse>,
  ): Promise<ResetPasswordResponse> {
    return this.auth.resetPassword(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
