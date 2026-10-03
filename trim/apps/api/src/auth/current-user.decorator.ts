import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import type { AuthenticatedRequest } from './jwt-auth.guard';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): SessionUser => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
