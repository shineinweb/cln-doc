import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { buildSessionCookieOptions, SESSION_COOKIE_NAME, type AuthUserView } from "@agency/auth";
import type { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { AuthService } from "./auth.service";
import { SESSION_TTL_MS } from "./auth.constants";
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, this.meta(req));
    this.setSessionCookie(res, result.sessionToken);
    return { data: result.user };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("login")
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.meta(req));
    this.setSessionCookie(res, result.sessionToken);
    return { data: result.user };
  }

  @Public()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    await this.authService.logout(token, this.meta(req));
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { data: { ok: true } };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const result = await this.authService.forgotPassword(dto, this.meta(req));
    return { data: result };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const result = await this.authService.resetPassword(dto, this.meta(req));
    return { data: result };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("verify-email")
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const result = await this.authService.verifyEmail(dto, this.meta(req));
    return { data: result };
  }

  @Get("me")
  me(@CurrentUser() user: AuthUserView | undefined) {
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }
    return { data: user };
  }

  private meta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      buildSessionCookieOptions({
        maxAgeMs: SESSION_TTL_MS,
        secure: process.env.NODE_ENV === "production",
      }),
    );
  }
}
