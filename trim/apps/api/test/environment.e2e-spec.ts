import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('environmental monitoring', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run environment tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
    tokenAdmin = await login(fixture.adminUser.email, fixture.adminUser.password);
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

  it('marks a reading older than the room threshold as stale, including a metric with no reading', async () => {
    await prisma.room.update({ where: { id: fixture.roomAId }, data: { staleAfterMinutes: 15 } });
    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/readings`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'room-a-rh',
        metric: 'relative_humidity',
        value: 61,
        unit: '%',
        recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        quality: 'good',
        isSample: false,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/readings`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'room-a-temp',
        metric: 'temperature',
        value: 72,
        unit: '°F',
        recordedAt: new Date(Date.now() - 60 * 1000).toISOString(),
        quality: 'good',
        isSample: false,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/alert-rules`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ metric: 'relative_humidity', kind: 'stale' })
      .expect(201);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const humidity = slot(room.body.latestReadings, 'relative_humidity');
    const temperature = slot(room.body.latestReadings, 'temperature');
    const substrate = slot(room.body.latestReadings, 'substrate');
    expect(humidity.stale).toBe(true);
    expect(humidity.value).toBe(61);
    expect(temperature.stale).toBe(false);
    expect(substrate.value).toBeNull();
    expect(substrate.stale).toBe(true);
    expect(room.body.activeAlerts.map((alert: { message: string }) => alert.message)).toContain(
      'Relative humidity is stale. No reading is newer than 15 minutes.',
    );
  });

  it('opens an alert when a live reading is outside its range and clears it when the next reading is inside', async () => {
    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomBId}/alert-rules`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ metric: 'temperature', kind: 'range', minValue: 60, maxValue: 80 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomBId}/readings`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        deviceId: 'room-b-temp',
        metric: 'temperature',
        value: 90,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'good',
        isSample: false,
      })
      .expect(201);

    const outside = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(outside.body.activeAlerts.some((alert: { message: string }) => /outside/i.test(alert.message))).toBe(true);

    await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomBId}/readings`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        deviceId: 'room-b-temp',
        metric: 'temperature',
        value: 70,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'good',
        isSample: false,
      })
      .expect(201);
    const inside = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(inside.body.activeAlerts.some((alert: { kind: string | null }) => alert.kind === 'range')).toBe(false);
  });

  it('imports a CSV row with device, unit, site-local timestamp, quality, and the sample flag', async () => {
    const csv = [
      'device_id,metric,value,unit,recorded_at,quality,sample',
      'csv-logger-1,co2,900,ppm,2026-10-03T09:30:00,suspect,true',
      'csv-logger-1,substrate,42,%,2026-10-03T09:30:00,good,false',
    ].join('\n');
    const imported = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/readings/import`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ csv })
      .expect(201);

    expect(imported.body.imported).toBe(2);
    const sample = imported.body.readings.find((reading: { metric: string }) => reading.metric === 'co2');
    const live = imported.body.readings.find((reading: { metric: string }) => reading.metric === 'substrate');
    expect(sample).toMatchObject({
      deviceId: 'csv-logger-1',
      unit: 'ppm',
      quality: 'suspect',
      isSample: true,
      recordedAt: '2026-10-03T16:30:00.000Z',
      value: 900,
    });
    expect(live).toMatchObject({
      deviceId: 'csv-logger-1',
      unit: '%',
      quality: 'good',
      isSample: false,
      recordedAt: '2026-10-03T16:30:00.000Z',
    });

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(slot(room.body.latestReadings, 'co2').isSample).toBe(true);
    expect(slot(room.body.readingHistory, 'co2').isSample).toBe(true);
  });

  it('denies a reading on another site and allows the organization admin', async () => {
    const own = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const readingAId = slot(own.body.latestReadings, 'temperature').id as string;
    const other = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const readingBId = slot(other.body.latestReadings, 'temperature').id as string;

    await request(app.getHttpServer())
      .get(`/readings/${readingAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('You do not have access to this reading.');
      });
    await request(app.getHttpServer())
      .get(`/readings/${readingBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/readings/${readingAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/readings/${readingAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/readings/${readingBId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
  });

  function slot(rows: Array<{ metric: string }>, metric: string) {
    const found = rows.find((row) => row.metric === metric);
    if (!found) {
      throw new Error(`Missing ${metric}`);
    }
    return found as {
      metric: string;
      id: string | null;
      value: number | null;
      stale?: boolean;
      isSample: boolean;
    };
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
