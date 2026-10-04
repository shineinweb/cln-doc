import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'trim_permissions';

/** Require any one of these permissions (org admins always pass). */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
