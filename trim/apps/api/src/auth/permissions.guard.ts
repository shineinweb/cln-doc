import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SessionUser } from '@trim/contracts';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { hasPermission } from './permissions';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (permissions.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user as SessionUser | undefined;
    if (!user) {
      throw new ForbiddenException('You do not have permission for this action.');
    }
    if (permissions.some((permission) => hasPermission(user, permission))) {
      return true;
    }
    throw new ForbiddenException(`You do not have permission for ${permissions.join(' or ')}.`);
  }
}
