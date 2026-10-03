import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessDirectory,
  AccessPermission,
  AccessPermissionInput,
  AccessRole,
  AccessRoleInput,
  AccessUser,
  AccessUserInput,
  RecordRemoved,
  SessionUser,
} from '@trim/contracts';
import { Prisma } from '@trim/database';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const userInclude = {
  userRoles: { include: { role: true }, orderBy: { createdAt: 'asc' as const } },
  memberships: { include: { site: true }, orderBy: { site: { name: 'asc' as const } } },
} satisfies Prisma.UserInclude;

const roleInclude = {
  permissions: { include: { permission: true }, orderBy: { permission: { key: 'asc' as const } } },
} satisfies Prisma.RoleInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type RoleRow = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

const PERMISSION_KEY = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async directory(user: SessionUser): Promise<AccessDirectory> {
    const [users, roles, permissions, audit, sites] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: user.organizationId },
        include: userInclude,
        orderBy: { name: 'asc' },
      }),
      this.prisma.role.findMany({
        where: { organizationId: user.organizationId },
        include: roleInclude,
        orderBy: { name: 'asc' },
      }),
      this.prisma.permission.findMany({ orderBy: { key: 'asc' } }),
      this.prisma.auditLog.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.site.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true },
      }),
    ]);
    return {
      users: users.map(toUser),
      roles: roles.map(toRole),
      permissions: permissions.map((permission) => ({
        id: permission.id,
        key: permission.key,
        description: permission.description,
      })),
      audit: audit.map((entry) => ({
        id: entry.id,
        at: entry.createdAt.toISOString(),
        actorName: entry.actorName,
        action: entry.action,
        summary: entry.summary,
      })),
      sites,
    };
  }

  async createUser(actor: SessionUser, input: AccessUserInput): Promise<AccessUser> {
    this.assertManager(actor);
    const email = this.email(input.email);
    const password = this.requiredPassword(input.password);
    const role = await this.requireRole(actor, input.roleId);
    const siteIds = await this.siteIds(actor, role.isOrgWide, input.siteIds);
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const created = await this.prisma.user.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          email,
          credential: { create: { passwordHash } },
          userRoles: { create: { roleId: role.id } },
          memberships: siteIds.length ? { create: siteIds.map((siteId) => ({ siteId })) } : undefined,
        },
        include: userInclude,
      });
      await this.record(actor, 'Created user', 'user', created.id, `Created user ${created.name} (${created.email}).`);
      return toUser(created);
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A user with that email already exists.');
      }
      throw error;
    }
  }

  async updateUser(actor: SessionUser, userId: string, input: AccessUserInput): Promise<AccessUser> {
    this.assertManager(actor);
    const existing = await this.requireUser(actor, userId);
    const email = this.email(input.email);
    const password = this.optionalPassword(input.password);
    const role = await this.requireRole(actor, input.roleId);
    const siteIds = await this.siteIds(actor, role.isOrgWide, input.siteIds);
    await this.assertKeepsAdmin(actor, existing, role.isOrgWide);
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: existing.id }, data: { name: input.name, email } });
        if (passwordHash) {
          await tx.credential.update({ where: { userId: existing.id }, data: { passwordHash } });
        }
        await tx.userRole.deleteMany({ where: { userId: existing.id } });
        await tx.userRole.create({ data: { userId: existing.id, roleId: role.id } });
        await tx.siteMembership.deleteMany({ where: { userId: existing.id } });
        if (siteIds.length) {
          await tx.siteMembership.createMany({ data: siteIds.map((siteId) => ({ userId: existing.id, siteId })) });
        }
        return tx.user.findUniqueOrThrow({ where: { id: existing.id }, include: userInclude });
      });
      await this.record(actor, 'Updated user', 'user', updated.id, `Updated user ${updated.name}.`);
      return toUser(updated);
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A user with that email already exists.');
      }
      throw error;
    }
  }

  async deleteUser(actor: SessionUser, userId: string): Promise<RecordRemoved> {
    this.assertManager(actor);
    if (actor.id === userId) {
      throw new BadRequestException('You cannot delete your own account.');
    }
    const existing = await this.requireUser(actor, userId);
    if (existing.userRoles.some((assignment) => assignment.role.isOrgWide)) {
      const others = await this.prisma.userRole.count({
        where: {
          userId: { not: existing.id },
          role: { organizationId: actor.organizationId, isOrgWide: true },
        },
      });
      if (others === 0) {
        throw new BadRequestException('Keep at least one organization admin.');
      }
    }
    try {
      await this.prisma.user.delete({ where: { id: existing.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('This user has recorded work and cannot be deleted.');
      }
      throw error;
    }
    await this.record(actor, 'Deleted user', 'user', existing.id, `Deleted user ${existing.name}.`);
    return { id: existing.id, removed: true, voided: false };
  }

  async createRole(actor: SessionUser, input: AccessRoleInput): Promise<AccessRole> {
    this.assertManager(actor);
    const permissionIds = await this.permissionIds(input.permissionIds);
    const key = roleKey(input.name);
    try {
      const created = await this.prisma.role.create({
        data: {
          organizationId: actor.organizationId,
          key,
          name: input.name,
          description: input.description,
          isOrgWide: input.opensEveryFacility,
          permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: roleInclude,
      });
      await this.record(actor, 'Created role', 'role', created.id, `Created role ${created.name}.`);
      return toRole(created);
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A role with that name already exists.');
      }
      throw error;
    }
  }

  async updateRole(actor: SessionUser, roleId: string, input: AccessRoleInput): Promise<AccessRole> {
    this.assertManager(actor);
    const existing = await this.requireRole(actor, roleId);
    const permissionIds = await this.permissionIds(input.permissionIds);
    if (existing.isOrgWide && !input.opensEveryFacility) {
      const otherAdmins = await this.prisma.userRole.count({
        where: { role: { organizationId: actor.organizationId, isOrgWide: true, id: { not: existing.id } } },
      });
      const heldBy = await this.prisma.userRole.count({ where: { roleId: existing.id } });
      if (otherAdmins === 0 && heldBy > 0) {
        throw new BadRequestException('Keep at least one organization admin.');
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: existing.id } });
      return tx.role.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          description: input.description,
          isOrgWide: input.opensEveryFacility,
          permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        },
        include: roleInclude,
      });
    });
    await this.record(actor, 'Updated role', 'role', updated.id, `Updated role ${updated.name}.`);
    return toRole(updated);
  }

  async deleteRole(actor: SessionUser, roleId: string): Promise<RecordRemoved> {
    this.assertManager(actor);
    const existing = await this.requireRole(actor, roleId);
    const assigned = await this.prisma.userRole.count({ where: { roleId: existing.id } });
    if (assigned > 0) {
      throw new BadRequestException('Remove this role from its users before deleting it.');
    }
    try {
      await this.prisma.role.delete({ where: { id: existing.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('This role is used by a task and cannot be deleted.');
      }
      throw error;
    }
    await this.record(actor, 'Deleted role', 'role', existing.id, `Deleted role ${existing.name}.`);
    return { id: existing.id, removed: true, voided: false };
  }

  async createPermission(actor: SessionUser, input: AccessPermissionInput): Promise<AccessPermission> {
    this.assertManager(actor);
    const key = this.permissionKey(input.key);
    try {
      const created = await this.prisma.permission.create({
        data: { key, description: input.description },
      });
      await this.record(actor, 'Created permission', 'permission', created.id, `Created permission ${created.key}.`);
      return { id: created.id, key: created.key, description: created.description };
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A permission with that key already exists.');
      }
      throw error;
    }
  }

  async updatePermission(
    actor: SessionUser,
    permissionId: string,
    input: AccessPermissionInput,
  ): Promise<AccessPermission> {
    this.assertManager(actor);
    await this.requirePermission(permissionId);
    const key = this.permissionKey(input.key);
    try {
      const updated = await this.prisma.permission.update({
        where: { id: permissionId },
        data: { key, description: input.description },
      });
      await this.record(actor, 'Updated permission', 'permission', updated.id, `Updated permission ${updated.key}.`);
      return { id: updated.id, key: updated.key, description: updated.description };
    } catch (error) {
      if (isUnique(error)) {
        throw new BadRequestException('A permission with that key already exists.');
      }
      throw error;
    }
  }

  async deletePermission(actor: SessionUser, permissionId: string): Promise<RecordRemoved> {
    this.assertManager(actor);
    const existing = await this.requirePermission(permissionId);
    await this.prisma.permission.delete({ where: { id: existing.id } });
    await this.record(actor, 'Deleted permission', 'permission', existing.id, `Deleted permission ${existing.key}.`);
    return { id: existing.id, removed: true, voided: false };
  }

  private assertManager(user: SessionUser) {
    if (!user.isOrgAdmin) {
      throw new ForbiddenException('Only a manager can change users, roles, and permissions.');
    }
  }

  private email(value: string): string {
    const email = value.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      throw new BadRequestException('Enter a valid email address.');
    }
    return email;
  }

  private requiredPassword(value: string): string {
    if (value.length < 8) {
      throw new BadRequestException('Enter a password of at least 8 characters.');
    }
    return value;
  }

  private optionalPassword(value: string): string | null {
    if (!value) {
      return null;
    }
    if (value.length < 8) {
      throw new BadRequestException('Enter a password of at least 8 characters.');
    }
    return value;
  }

  private permissionKey(value: string): string {
    const key = value.trim().toLowerCase();
    if (!PERMISSION_KEY.test(key)) {
      throw new BadRequestException('Use a permission key like notes.read.');
    }
    return key;
  }

  private async requireUser(actor: SessionUser, userId: string): Promise<UserRow> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      include: userInclude,
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return user;
  }

  private async requireRole(actor: SessionUser, roleId: string): Promise<RoleRow> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
      include: roleInclude,
    });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return role;
  }

  private async requirePermission(permissionId: string) {
    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException('Permission not found.');
    }
    return permission;
  }

  private async siteIds(actor: SessionUser, opensEveryFacility: boolean, requested: string[]): Promise<string[]> {
    const unique = [...new Set(requested)];
    if (!opensEveryFacility && unique.length === 0) {
      throw new BadRequestException('Choose a facility for this user.');
    }
    if (unique.length === 0) {
      return [];
    }
    const sites = await this.prisma.site.findMany({
      where: { id: { in: unique }, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (sites.length !== unique.length) {
      throw new BadRequestException('That facility is not in this organization.');
    }
    return unique;
  }

  private async permissionIds(requested: string[]): Promise<string[]> {
    const unique = [...new Set(requested)];
    if (unique.length === 0) {
      return [];
    }
    const rows = await this.prisma.permission.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException('That permission does not exist.');
    }
    return unique;
  }

  private async assertKeepsAdmin(actor: SessionUser, existing: UserRow, nextIsOrgWide: boolean) {
    const currentlyAdmin = existing.userRoles.some((assignment) => assignment.role.isOrgWide);
    if (!currentlyAdmin || nextIsOrgWide) {
      return;
    }
    if (actor.id === existing.id) {
      throw new BadRequestException('You cannot remove your own organization admin role.');
    }
    const others = await this.prisma.userRole.count({
      where: {
        userId: { not: existing.id },
        role: { organizationId: actor.organizationId, isOrgWide: true },
      },
    });
    if (others === 0) {
      throw new BadRequestException('Keep at least one organization admin.');
    }
  }

  private async record(actor: SessionUser, action: string, entityType: string, entityId: string, summary: string) {
    await this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action,
        entityType,
        entityId,
        summary,
      },
    });
  }
}

function toUser(user: UserRow): AccessUser {
  const role = user.userRoles[0]?.role;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: role?.id ?? null,
    roleName: role?.name ?? 'No role',
    opensEveryFacility: Boolean(role?.isOrgWide),
    siteIds: user.memberships.map((membership) => membership.siteId),
    siteNames: user.memberships.map((membership) => membership.site.name),
  };
}

function toRole(role: RoleRow): AccessRole {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    opensEveryFacility: role.isOrgWide,
    permissionIds: role.permissions.map((link) => link.permissionId),
    permissionKeys: role.permissions.map((link) => link.permission.key),
  };
}

function roleKey(name: string): string {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return key || 'role';
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function recordSignIn(
  prisma: PrismaService,
  user: { id: string; organizationId: string; name: string },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorId: user.id,
      actorName: user.name,
      action: 'Signed in',
      entityType: 'user',
      entityId: user.id,
      summary: `${user.name} signed in.`,
    },
  });
}
