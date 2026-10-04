import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('auth password reset and email broadcasts', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let mail: MailService;
  let fixture: AccessFixture;
  let tokenAdmin = '';
  let siteAPassword = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run email auth tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    siteAPassword = fixture.siteAUser.password;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    mail = app.get(MailService);
    tokenAdmin = await login(fixture.adminUser.email, fixture.adminUser.password);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    mail.clearOutbox();
  });

  it('sends a reset link and accepts a new password without enumerating unknown emails', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'missing@example.com' })
      .expect(200);
    expect(unknown.body.ok).toBe(true);
    expect(mail.peekOutbox()).toHaveLength(0);

    const forgot = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: fixture.siteAUser.email })
      .expect(200);
    expect(forgot.body.ok).toBe(true);
    const outbound = mail.peekOutbox();
    expect(outbound).toHaveLength(1);
    expect(outbound[0]!.to).toBe(fixture.siteAUser.email);
    const match = outbound[0]!.text.match(/token=([a-f0-9]+)/);
    expect(match?.[1]).toBeTruthy();
    const token = match![1]!;

    siteAPassword = 'New-access-pass';
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: siteAPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.siteAUser.email, password: fixture.siteAUser.password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: fixture.siteAUser.email, password: siteAPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token, password: 'Another-pass-99' })
      .expect(400);
  });

  it('lets an org admin broadcast marketing email to the organization', async () => {
    const operatorToken = await login(fixture.siteAUser.email, siteAPassword);
    const denied = await request(app.getHttpServer())
      .post('/communications/broadcasts')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ subject: 'Denied', body: 'No' })
      .expect(403);

    expect(denied.body.message).toBeTruthy();

    const sent = await request(app.getHttpServer())
      .post('/communications/broadcasts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ subject: 'Harvest week', body: 'Please confirm lunch coverage.' })
      .expect(201);
    expect(sent.body.subject).toBe('Harvest week');
    expect(sent.body.recipientCount).toBeGreaterThanOrEqual(2);
    expect(mail.peekOutbox().some((item) => item.subject === 'Harvest week')).toBe(true);

    const list = await request(app.getHttpServer())
      .get('/communications/broadcasts')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(list.body.broadcasts[0].subject).toBe('Harvest week');
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
