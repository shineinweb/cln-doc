import { ForbiddenException } from '@nestjs/common';
import type { SessionUser } from '@trim/contracts';

export function assertManager(user: SessionUser): void {
  if (!user.isOrgAdmin) {
    throw new ForbiddenException('Only a manager can change workflows.');
  }
}
