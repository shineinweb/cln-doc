import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('organization settings', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run settings tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenAdmin = await login(fixture.adminUser.email, fixture.adminUser.password);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('saves general settings and Metrc keys without returning the keys', async () => {
    const denied = await request(app.getHttpServer())
      .patch('/settings/general')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ companyName: 'Denied Co', title: 'Nope', description: 'Nope' });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe('You do not have permission for settings.manage.');

    const saved = await request(app.getHttpServer())
      .patch('/settings/general')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ companyName: 'Access Org Settings', title: 'Cultivation', description: 'Daily workspace' });
    expect(saved.status).toBe(200);
    expect(saved.body.general).toEqual({
      companyName: 'Access Org Settings',
      title: 'Cultivation',
      description: 'Daily workspace',
    });

    const integrator = 'integrator-key-not-in-the-response';
    const userKey = 'user-key-not-in-the-response';
    const metrc = await request(app.getHttpServer())
      .post('/settings/metrc')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ integratorApiKey: integrator, userApiKey: userKey, licenseNumber: 'OR-CULT-1' });
    expect(metrc.status).toBe(201);
    expect(metrc.body.metrc).toEqual({
      integratorKeySaved: true,
      userKeySaved: true,
      licenseNumber: 'OR-CULT-1',
    });
    expect(JSON.stringify(metrc.body)).not.toContain(integrator);
    expect(JSON.stringify(metrc.body)).not.toContain(userKey);

    const stored = await prisma.metrcApiSetting.findUniqueOrThrow({
      where: { organizationId: fixture.organizationId },
    });
    expect(stored.integratorApiKey).toBe(integrator);
    expect(stored.userApiKey).toBe(userKey);
    expect(stored.licenseNumber).toBe('OR-CULT-1');
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
