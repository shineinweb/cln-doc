import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAllPermissions, type RequestAuthContext } from "@agency/auth";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ auth?: RequestAuthContext }>();
    const auth = request.auth;
    if (!auth) {
      throw new ForbiddenException("Authorization required");
    }

    if (!hasAllPermissions(auth.user.permissions, required)) {
      throw new ForbiddenException("Missing required permissions");
    }

    return true;
  }
}
