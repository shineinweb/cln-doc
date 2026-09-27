import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SESSION_COOKIE_NAME } from "@agency/auth";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthService } from "../../auth/auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context
      .switchToHttp()
      .getRequest<Request & { cookies?: Record<string, string>; auth?: unknown }>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];

    if (!token) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException("Authentication required");
    }

    const auth = await this.authService.resolveSession(token);
    if (!auth) {
      if (isPublic) {
        return true;
      }
      throw new UnauthorizedException("Invalid or expired session");
    }

    request.auth = auth;
    return true;
  }
}
