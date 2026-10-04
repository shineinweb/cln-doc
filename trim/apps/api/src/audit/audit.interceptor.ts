import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';
import { Observable, from, of, switchMap, map, catchError, throwError } from 'rxjs';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';

const SKIP = new Set(['/health', '/auth/login', '/auth/me']);
/** High-frequency polls that would drown the audit log. */
const SKIP_GET = new Set(['/timeclock/status']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = (request.method ?? 'GET').toUpperCase();
    const path = request.path || request.url?.split('?')[0] || '';
    const user = request.user as SessionUser | undefined;
    const shouldLog =
      Boolean(user) &&
      !SKIP.has(path) &&
      !(method === 'GET' && SKIP_GET.has(path));

    return next.handle().pipe(
      switchMap((value) => {
        if (!shouldLog || !user) {
          return of(value);
        }
        return from(
          this.audit.record(user, {
            action: actionLabel(method),
            entityType: entityTypeFromPath(path),
            entityId: entityIdFromPath(path),
            summary: `${user.name} ${method} ${path}`,
          }),
        ).pipe(map(() => value));
      }),
      catchError((error) => {
        if (!shouldLog || !user) {
          return throwError(() => error);
        }
        const status = typeof error?.status === 'number' ? error.status : typeof error?.getStatus === 'function' ? error.getStatus() : null;
        const statusPart = status ? ` → ${status}` : ' → failed';
        return from(
          this.audit.record(user, {
            action: actionLabel(method),
            entityType: entityTypeFromPath(path),
            entityId: entityIdFromPath(path),
            summary: `${user.name} ${method} ${path}${statusPart}`.slice(0, 500),
          }),
        ).pipe(switchMap(() => throwError(() => error)));
      }),
    );
  }
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
