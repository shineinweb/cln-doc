import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  InMemoryEmailProvider,
  isPasswordPolicyValid,
  PORTAL_PERMISSIONS,
  slugifyOrganizationName,
  type AuthUserView,
  type EmailProvider,
  type RequestAuthContext,
  verifyPassword,
} from "@agency/auth";
import { prisma } from "@agency/database";
import { AuditService } from "../audit/audit.service";
import {
  EMAIL_PROVIDER,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
} from "./auth.constants";
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async register(
    dto: RegisterDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ user: AuthUserView; sessionToken: string }> {
    if (!isPasswordPolicyValid(dto.password)) {
      throw new BadRequestException("Password must be between 10 and 128 characters");
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const slug = slugifyOrganizationName(dto.organizationName);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash,
          isStaff: false,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      await tx.customer.create({
        data: {
          organizationId: organization.id,
          displayName: dto.organizationName.trim(),
          status: "active",
        },
      });

      const sessionToken = generateOpaqueToken();
      const session = await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(sessionToken),
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        },
      });

      const verifyToken = generateOpaqueToken();
      await tx.authToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFICATION",
          tokenHash: hashToken(verifyToken),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });

      return { user, organization, session, sessionToken, verifyToken };
    });

    await this.email.send({
      to: email,
      subject: "Verify your Agency AI email",
      text: `Verify your email with this token: ${result.verifyToken}`,
      html: `<p>Verify your email with this token:</p><code>${result.verifyToken}</code>`,
    });

    await this.audit.write({
      actorUserId: result.user.id,
      actorType: "customer",
      organizationId: result.organization.id,
      action: "auth.register",
      entityType: "User",
      entityId: result.user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    const userView = await this.buildUserView(result.user.id);
    return { user: userView, sessionToken: result.sessionToken };
  }

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ user: AuthUserView; sessionToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    const valid =
      user && user.isActive ? await verifyPassword(user.passwordHash, dto.password) : false;

    if (!user || !valid) {
      await this.audit.write({
        actorUserId: user?.id,
        actorType: user?.isStaff ? "staff" : "customer",
        action: "auth.login_failed",
        entityType: "User",
        entityId: user?.id ?? email,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException("Invalid email or password");
    }

    const sessionToken = generateOpaqueToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    await this.audit.write({
      actorUserId: user.id,
      actorType: user.isStaff ? "staff" : "customer",
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: await this.buildUserView(user.id),
      sessionToken,
    };
  }

  async logout(
    sessionToken: string | undefined,
    meta: { ip?: string; userAgent?: string },
  ): Promise<void> {
    if (!sessionToken) {
      return;
    }

    const tokenHash = hashToken(sessionToken);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session) {
      return;
    }

    await prisma.session.delete({ where: { id: session.id } });
    await this.audit.write({
      actorUserId: session.userId,
      actorType: "user",
      action: "auth.logout",
      entityType: "Session",
      entityId: session.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: { ip?: string; userAgent?: string }) {
    const email = dto.email.trim().toLowerCase();
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

    // Always return success to avoid account enumeration.
    if (!user) {
      return { ok: true as const };
    }

    await prisma.authToken.updateMany({
      where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = generateOpaqueToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    await this.email.send({
      to: email,
      subject: "Reset your Agency AI password",
      text: `Reset token: ${token}`,
      html: `<p>Reset token:</p><code>${token}</code>`,
    });

    await this.audit.write({
      actorUserId: user.id,
      actorType: user.isStaff ? "staff" : "customer",
      action: "auth.forgot_password",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true as const };
  }

  async resetPassword(dto: ResetPasswordDto, meta: { ip?: string; userAgent?: string }) {
    if (!isPasswordPolicyValid(dto.password)) {
      throw new BadRequestException("Password must be between 10 and 128 characters");
    }

    const tokenHash = hashToken(dto.token);
    const authToken = await prisma.authToken.findUnique({ where: { tokenHash } });
    if (
      !authToken ||
      authToken.type !== "PASSWORD_RESET" ||
      authToken.usedAt ||
      authToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await hashPassword(dto.password);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authToken.userId },
        data: { passwordHash },
      });
      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId: authToken.userId } });
    });

    await this.audit.write({
      actorUserId: authToken.userId,
      actorType: "user",
      action: "auth.reset_password",
      entityType: "User",
      entityId: authToken.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true as const };
  }

  async verifyEmail(dto: VerifyEmailDto, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = hashToken(dto.token);
    const authToken = await prisma.authToken.findUnique({ where: { tokenHash } });
    if (
      !authToken ||
      authToken.type !== "EMAIL_VERIFICATION" ||
      authToken.usedAt ||
      authToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: authToken.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.authToken.update({
        where: { id: authToken.id },
        data: { usedAt: new Date() },
      });
    });

    await this.audit.write({
      actorUserId: authToken.userId,
      actorType: "user",
      action: "auth.verify_email",
      entityType: "User",
      entityId: authToken.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true as const };
  }

  async resolveSession(sessionToken: string): Promise<RequestAuthContext | null> {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(sessionToken) },
    });

    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      return null;
    }

    const user = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null, isActive: true },
    });
    if (!user) {
      return null;
    }

    return {
      sessionId: session.id,
      user: await this.buildUserView(user.id),
    };
  }

  async buildUserView(userId: string): Promise<AuthUserView> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        organizationMembers: {
          include: { organization: true },
        },
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roleKeys = user.userRoles.map((item) => item.role.key);
    const staffPermissions = new Set<string>();
    for (const userRole of user.userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        staffPermissions.add(rolePermission.permission.key);
      }
    }

    const portalPermissions = new Set<string>();
    for (const membership of user.organizationMembers) {
      for (const permission of PORTAL_PERMISSIONS[membership.role]) {
        portalPermissions.add(permission);
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isStaff: user.isStaff,
      emailVerified: Boolean(user.emailVerifiedAt),
      memberships: user.organizationMembers.map((membership) => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        role: membership.role,
      })),
      roles: roleKeys,
      permissions: [...new Set([...staffPermissions, ...portalPermissions])],
    };
  }
}

export { InMemoryEmailProvider };
