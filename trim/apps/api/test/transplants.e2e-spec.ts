import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('transplant schedule', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run transplant tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Transplant crop',
        cultivar: 'Test',
        plantCount: 10,
        stage: 'veg',
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
    await prisma.roomTransplant.deleteMany({ where: { roomId: { in: [fixture.roomAId, fixture.roomBId] } } });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('stores transplant days counted from the cycle start', async () => {
    const denied = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/transplants`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ days: [7] });
    expect(denied.status).toBe(403);

    const duplicate = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/transplants`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [7, 7] });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toBe('Each transplant day can be listed once.');

    const saved = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/transplants`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [14, 7] });
    expect(saved.status).toBe(200);
    expect(saved.body.map((row: { dayNumber: number; date: string }) => [row.dayNumber, row.date])).toEqual([
      [7, '2026-10-09'],
      [14, '2026-10-16'],
    ]);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.transplants.map((row: { dayNumber: number; date: string }) => [row.dayNumber, row.date])).toEqual([
      [7, '2026-10-09'],
      [14, '2026-10-16'],
    ]);

    const cleared = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/transplants`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [] });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toEqual([]);

    const dry = await prisma.room.create({
      data: { siteId: fixture.siteAId, name: 'Dry transplant', code: `DRYT${fixture.roomAId.slice(-5)}`, roomType: 'dry' },
    });
    const dryDenied = await request(app.getHttpServer())
      .put(`/rooms/${dry.id}/transplants`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ days: [7] });
    expect(dryDenied.status).toBe(400);
    expect(dryDenied.body.message).toBe('A dry room does not use a transplant schedule.');
    await prisma.room.delete({ where: { id: dry.id } });

    const withoutCrop = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomBId}/transplants`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ days: [7] });
    expect(withoutCrop.status).toBe(200);
    expect(withoutCrop.body).toEqual([expect.objectContaining({ dayNumber: 7, date: null })]);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
