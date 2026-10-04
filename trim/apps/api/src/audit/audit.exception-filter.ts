import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

const SKIP = new Set(['/health', '/auth/login', '/auth/me']);
const SKIP_GET = new Set(['/timeclock/status']);

/**
 * Guards run before interceptors, so permission denials never reach AuditInterceptor.
 * This filter records authenticated failures (including 403 from PermissionsGuard).
 */
@Catch()
export class AuditExceptionFilter implements ExceptionFilter {
  constructor(private readonly audit: AuditService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();
    const method = (request.method ?? 'GET').toUpperCase();
    const path = request.path || request.url?.split('?')[0] || '';
    const user = request.user as SessionUser | undefined;
    const status = statusOf(exception);
    const shouldLog =
      Boolean(user) &&
      !SKIP.has(path) &&
      !(method === 'GET' && SKIP_GET.has(path));

    if (shouldLog && user) {
      try {
        await this.audit.record(user, {
          action: actionLabel(method),
          entityType: entityTypeFromPath(path),
          entityId: entityIdFromPath(path),
          summary: `${user.name} ${method} ${path} → ${status}`.slice(0, 500),
        });
      } catch {
        // Never mask the original failure because audit write failed.
      }
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };
    if (!response.headersSent) {
      response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    }
  }
}

function statusOf(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

function actionLabel(method: string): string {
  switch (method) {
    case 'GET':
      return 'Viewed';
    case 'DELETE':
      return 'Deleted';
    case 'POST':
      return 'Created';
    case 'PUT':
    case 'PATCH':
      return 'Changed';
    default:
      return method.slice(0, 64);
  }
}

function entityTypeFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[0] ?? 'app';
}

function entityIdFromPath(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  const id = parts.find((part) => part.length >= 20 && !part.includes('.'));
  return id ?? null;
}
