import { Body, Controller, Get, HttpCode, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resetPasswordRequestSchema,
  selfProfileInputSchema,
  selfProfileSchema,
  type ForgotPasswordResponse,
  type LoginResponse,
  type ResetPasswordResponse,
  type SelfProfileInput,
  type SessionUser,
} from '@trim/contracts';
import { memoryStorage } from 'multer';
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

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: SessionUser) {
    return selfProfileSchema.parse(await this.auth.profile(user));
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(selfProfileInputSchema)) body: SelfProfileInput,
  ) {
    return selfProfileSchema.parse(await this.auth.updateProfile(user, body));
  }

  @Post('profile/photo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadProfilePhoto(
    @CurrentUser() user: SessionUser,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ) {
    return selfProfileSchema.parse(await this.auth.setProfilePhoto(user, file));
  }
}
