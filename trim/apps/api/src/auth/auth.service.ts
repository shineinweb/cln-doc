import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  SelfProfile,
  SelfProfileInput,
  SessionUser,
} from '@trim/contracts';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { recordSignIn } from '../access/access.service';
import { loadEnv } from '../env';
import { passwordResetEmail } from '../mail/email-templates';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../storage/attachments.service';
import { toSessionUser, userAccessInclude } from './session-user';

const RESET_TTL_MS = 60 * 60 * 1000;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class AuthService {
  private dummyHashPromise: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly attachments: AttachmentsService,
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
    const rendered = passwordResetEmail({ name: user.name, resetUrl: link });
    await this.mail.send({
      to: user.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
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

  async profile(actor: SessionUser): Promise<SelfProfile> {
    const user = await this.ownUser(actor);
    return toSelfProfile(user);
  }

  async updateProfile(actor: SessionUser, input: SelfProfileInput): Promise<SelfProfile> {
    const user = await this.ownUser(actor);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        phone: blank(input.phone),
        addressLine1: blank(input.addressLine1),
        city: blank(input.city),
        region: blank(input.region),
        postalCode: blank(input.postalCode),
      },
    });
    return toSelfProfile(updated);
  }

  async setProfilePhoto(
    actor: SessionUser,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined,
  ): Promise<SelfProfile> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a photo to upload.');
    }
    if (!PHOTO_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Photo must be a JPEG, PNG, WebP, or GIF.');
    }
    const user = await this.ownUser(actor);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'photo';
    const objectKey = `orgs/${user.organizationId}/users/${user.id}/photo-${Date.now()}-${safeName}`;
    await this.attachments.put(objectKey, file.buffer, file.mimetype);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { photoObjectKey: objectKey },
    });
    if (user.photoObjectKey && user.photoObjectKey !== objectKey) {
      await this.attachments.delete(user.photoObjectKey).catch(() => undefined);
    }
    return toSelfProfile(updated);
  }

  private async ownUser(actor: SessionUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, organizationId: actor.organizationId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private dummyHash(): Promise<string> {
    this.dummyHashPromise ??= bcrypt.hash('trim-invalid-user', 10);
    return this.dummyHashPromise;
  }
}

function toSelfProfile(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  photoObjectKey: string | null;
}): SelfProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    addressLine1: user.addressLine1,
    city: user.city,
    region: user.region,
    postalCode: user.postalCode,
    photoUrl: user.photoObjectKey ? `/access/users/${user.id}/photo` : null,
  };
}

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
