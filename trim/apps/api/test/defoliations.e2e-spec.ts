import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('defoliation schedule', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run defoliation tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Defoliation crop',
        cultivar: 'Test',
        plantCount: 10,
        stage: 'flower',
        startDate: new Date('2026-10-03T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-12-04T00:00:00.000Z'),
        status: 'active',
      },
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
  });

  afterAll(async () => {
    await prisma.roomDefoliation.deleteMany({ where: { roomId: { in: [fixture.roomAId, fixture.roomBId] } } });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('stores several defoliation days counted from the cycle start', async () => {
    const denied = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/defoliations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ days: [10] });
    expect(denied.status).toBe(403);

    const duplicate = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/defoliations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [10, 10] });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toBe('Each defoliation day can be listed once.');

    const saved = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/defoliations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [21, 10] });
    expect(saved.status).toBe(200);
    expect(saved.body.map((row: { dayNumber: number; date: string }) => [row.dayNumber, row.date])).toEqual([
      [10, '2026-10-12'],
      [21, '2026-10-23'],
    ]);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.defoliations.map((row: { dayNumber: number; date: string }) => [row.dayNumber, row.date])).toEqual([
      [10, '2026-10-12'],
      [21, '2026-10-23'],
    ]);

    const cleared = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/defoliations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual([]);

    const withoutCrop = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomBId}/defoliations`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ days: [10] });
    expect(withoutCrop.status).toBe(200);
    expect(withoutCrop.body).toEqual([expect.objectContaining({ dayNumber: 10, date: null })]);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
