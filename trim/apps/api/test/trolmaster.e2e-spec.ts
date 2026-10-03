import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('TrolMaster credentials', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run TrolMaster tests against ${process.env.DATABASE_URL}`);
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

  it('stores a controller credential without returning it, and denies the other facility', async () => {
    const secret = 'trolmaster-secret-not-in-the-response';
    const denied = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteBId}/trolmaster`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ roomId: fixture.roomBId, controllerId: 'other-controller', apiCredential: secret });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe('You do not have access to this site');

    const wrongRoom = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/trolmaster`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ roomId: fixture.roomBId, controllerId: 'cross-site', apiCredential: secret });
    expect(wrongRoom.status).toBe(400);
    expect(wrongRoom.body.message).toBe('That room is not on this facility.');

    const saved = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/trolmaster`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ roomId: fixture.roomAId, controllerId: 'tm-controller-1', apiCredential: secret });
    expect(saved.status).toBe(201);
    expect(saved.body.controllerId).toBe('tm-controller-1');
    expect(saved.body.credentialSaved).toBe(true);
    expect(JSON.stringify(saved.body)).not.toContain(secret);

    const listed = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/trolmaster`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        roomId: fixture.roomAId,
        controllerId: 'tm-controller-1',
        credentialSaved: true,
      }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain(secret);

    const stored = await prisma.trolmasterConnection.findUniqueOrThrow({ where: { roomId: fixture.roomAId } });
    expect(stored.apiCredential).toBe(secret);
    expect(stored.controllerId).toBe('tm-controller-1');
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
