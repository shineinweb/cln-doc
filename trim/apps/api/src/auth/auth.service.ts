import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SessionUser,
} from '@trim/contracts';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { recordSignIn } from '../access/access.service';
import { loadEnv } from '../env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { toSessionUser, userAccessInclude } from './session-user';

const RESET_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async login(input: LoginRequest): Promise<LoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { ...userAccessInclude, credential: true },
    });

    if (!user?.credential) {
      await bcrypt.compare(input.password, await this.dummyHash());
      throw new UnauthorizedException('Invalid email or password');
    }

    const matches = await bcrypt.compare(input.password, user.credential.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await recordSignIn(this.prisma, user);

    const env = loadEnv();
    const sessionUser = toSessionUser(user);
    const accessToken = jwt.sign(
      { sub: user.id, orgId: user.organizationId, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN_SECONDS },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
      user: sessionUser,
    };
  }

  async forgotPassword(input: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    const message = {
      ok: true as const,
      message: 'If that email is on file, password reset instructions were sent.',
    };
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { credential: true },
    });
    if (!user?.credential) {
      await bcrypt.compare('trim-timing', await this.dummyHash());
      return message;
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const env = loadEnv();
    const link = `${env.WEB_ORIGIN.replace(/\/$/, '')}/reset-password?token=${token}`;
    await this.mail.send({
      to: user.email,
      subject: 'Reset your Serenity password',
      text: [
        `Hi ${user.name},`,
        '',
        'Use this link to choose a new Serenity password. It expires in one hour.',
        link,
        '',
        'If you did not ask for a reset, you can ignore this email.',
        '',
        '— Serenity Universal',
      ].join('\n'),
      html: `<p>Hi ${escapeHtml(user.name)},</p><p>Use this link to choose a new Serenity password. It expires in one hour.</p><p><a href="${link}">Reset password</a></p><p>If you did not ask for a reset, you can ignore this email.</p><p>— Serenity Universal</p>`,
    });
    return message;
  }

  async resetPassword(input: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    const tokenHash = hashToken(input.token);
    const row = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { include: { credential: true } } },
    });
    if (!row?.user.credential) {
      throw new BadRequestException('That reset link is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    await this.prisma.$transaction([
      this.prisma.credential.update({
        where: { userId: row.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null, id: { not: row.id } },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true, message: 'Your password was updated. You can sign in now.' };
  }

  async authenticate(token: string): Promise<SessionUser> {
    const env = loadEnv();
    let sub: string;
    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Authentication required');
      }
      sub = payload.sub;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: userAccessInclude,
    });
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return toSessionUser(user);
  }

  private dummyHash(): Promise<string> {
    this.dummyHashPromise ??= bcrypt.hash('trim-invalid-user', 10);
    return this.dummyHashPromise;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
