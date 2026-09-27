import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestAuthContext } from "@agency/auth";

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ auth?: RequestAuthContext }>();
  return request.auth?.user;
});

export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<{ auth?: RequestAuthContext }>();
  return request.auth;
});
