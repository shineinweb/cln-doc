import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthenticatedRequest = Request & { user: SessionUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }
    request.user = await this.auth.authenticate(token);
    return true;
  }
}
