import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { assertStaff, type RequestAuthContext } from "@agency/auth";

/**
 * Admin routes require staff users. Customers authenticated for the portal
 * must never reach /admin APIs.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ auth?: RequestAuthContext }>();
    const auth = request.auth;
    if (!auth) {
      throw new ForbiddenException("Authorization required");
    }

    try {
      assertStaff(auth.user);
    } catch {
      throw new ForbiddenException("Staff access required");
    }

    return true;
  }
}
