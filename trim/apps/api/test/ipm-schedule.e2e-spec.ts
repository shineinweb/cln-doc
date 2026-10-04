import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('room IPM schedule', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run IPM schedule tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
  });

  afterAll(async () => {
    await prisma.room.update({ where: { id: fixture.roomAId }, data: { ipmWeekdays: null } });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('saves a twice-a-week IPM schedule on the room and rejects other counts', async () => {
    const denied = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/ipm-schedule`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ weekdays: ['tue', 'fri'] });
    expect(denied.status).toBe(403);

    const oneDay = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/ipm-schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ weekdays: ['tue'] });
    expect(oneDay.status).toBe(400);
    expect(oneDay.body.message).toContain('exactly two days');

    const threeDays = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/ipm-schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ weekdays: ['mon', 'tue', 'wed'] });
    expect(threeDays.status).toBe(400);

    const saved = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/ipm-schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ weekdays: ['fri', 'tue'] })
      .expect(200);
    expect(saved.body.weekdays).toEqual(['tue', 'fri']);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.ipmSchedule).toEqual({ weekdays: ['tue', 'fri'] });

    const cleared = await request(app.getHttpServer())
      .put(`/rooms/${fixture.roomAId}/ipm-schedule`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ weekdays: [] })
      .expect(200);
    expect(cleared.body.weekdays).toEqual([]);

    const afterClear = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterClear.body.ipmSchedule).toEqual({ weekdays: [] });
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
