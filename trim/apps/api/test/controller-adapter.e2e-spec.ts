import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('controller adapter', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let alertId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run controller adapter tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const rule = await prisma.alertRule.create({
      data: {
        roomId: fixture.roomAId,
        metric: 'temperature',
        kind: 'range',
        minValue: 60,
        maxValue: 80,
      },
    });
    await prisma.environmentalReading.create({
      data: {
        roomId: fixture.roomAId,
        deviceId: 'room-a-live-temp',
        metric: 'temperature',
        value: 90,
        unit: '°F',
        recordedAt: new Date(),
        quality: 'good',
        isSample: false,
      },
    });
    const alert = await prisma.roomAlert.create({
      data: {
        roomId: fixture.roomAId,
        ruleId: rule.id,
        metric: 'temperature',
        kind: 'range',
        message: 'Temperature is outside 60–80 °F. The latest reading is 90 °F.',
        active: true,
      },
    });
    alertId = alert.id;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
  });

  afterAll(async () => {
    if (prisma && fixture) {
      await prisma.organization.deleteMany({
        where: { id: { in: [fixture.organizationId, fixture.otherOrganizationId] } },
      });
      await prisma.$disconnect();
    }
    if (app) {
      await app.close();
    }
  });

  it('stores a sample payload and does not clear or create a range alert', async () => {
    const before = await prisma.environmentalReading.count({ where: { roomId: fixture.roomAId } });
    const inside = await request(app.getHttpServer())
      .post(`/adapters/controllers/rooms/${fixture.roomAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'hh-flower-1-controller',
        metric: 'setpoint',
        value: 70,
        unit: '°F',
        recordedAt: '2026-10-03T09:30:00',
        quality: 'good',
      })
      .expect(201);
    expect(inside.body).toMatchObject({
      deviceId: 'hh-flower-1-controller',
      unit: '°F',
      quality: 'good',
      recordedAt: '2026-10-03T16:30:00.000Z',
      isSample: true,
      value: 70,
    });

    await request(app.getHttpServer())
      .post(`/adapters/controllers/rooms/${fixture.roomAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'hh-flower-1-controller',
        metric: 'setpoint',
        value: 95,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'suspect',
        isSample: false,
      })
      .expect(400);

    const outside = await request(app.getHttpServer())
      .post(`/adapters/controllers/rooms/${fixture.roomAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'hh-flower-1-controller',
        metric: 'setpoint',
        value: 95,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'suspect',
      })
      .expect(201);
    expect(outside.body.isSample).toBe(true);
    expect(outside.body.quality).toBe('suspect');

    const listed = await request(app.getHttpServer())
      .get(`/adapters/controllers/rooms/${fixture.roomAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listed.body.every((row: { isSample: boolean }) => row.isSample === true)).toBe(true);
    expect(listed.body).toHaveLength(2);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.activeAlerts).toEqual([
      expect.objectContaining({
        id: alertId,
        message: 'Temperature is outside 60–80 °F. The latest reading is 90 °F.',
      }),
    ]);
    const after = await prisma.environmentalReading.count({ where: { roomId: fixture.roomAId } });
    expect(after).toBe(before);
    const temperature = room.body.latestReadings.find((row: { metric: string }) => row.metric === 'temperature');
    expect(temperature.value).toBe(90);
    expect(temperature.isSample).toBe(false);
  });

  it('denies a controller sample from another site', async () => {
    await request(app.getHttpServer())
      .post(`/adapters/controllers/rooms/${fixture.roomAId}/samples`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        deviceId: 'other-controller',
        metric: 'setpoint',
        value: 70,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'good',
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('You do not have access to this controller.');
      });
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
