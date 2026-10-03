import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginRequest, LoginResponse, SessionUser } from '@trim/contracts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loadEnv } from '../env';
import { PrismaService } from '../prisma/prisma.service';
import { toSessionUser, userAccessInclude } from './session-user';

@Injectable()
export class AuthService {
  private dummyHashPromise: Promise<string> | undefined;

  constructor(private readonly prisma: PrismaService) {}

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
