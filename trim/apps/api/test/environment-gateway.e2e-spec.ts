import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('environment gateway adapter', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let gatewayAId = '';
  let gatewayBId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run gateway tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    gatewayAId = (
      await prisma.sensorGateway.create({
        data: { siteId: fixture.siteAId, name: 'Site A environment' },
      })
    ).id;
    gatewayBId = (
      await prisma.sensorGateway.create({
        data: { siteId: fixture.siteBId, name: 'Site B environment' },
      })
    ).id;
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

  it('stores device, unit, timestamp, and quality as a live reading and leaves a stale metric stale', async () => {
    await prisma.room.update({ where: { id: fixture.roomAId }, data: { staleAfterMinutes: 60 } });
    await prisma.environmentalReading.create({
      data: {
        roomId: fixture.roomAId,
        deviceId: 'room-a-rh',
        metric: 'relative_humidity',
        value: 58.2,
        unit: '%',
        recordedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        quality: 'good',
        isSample: false,
      },
    });
    await prisma.alertRule.create({
      data: { roomId: fixture.roomAId, metric: 'relative_humidity', kind: 'stale' },
    });

    const posted = await request(app.getHttpServer())
      .post(`/adapters/environment/gateways/${gatewayAId}/readings`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomId: fixture.roomAId,
        deviceId: 'hh-gateway-co2',
        metric: 'co2',
        value: 980,
        unit: 'ppm',
        recordedAt: '2026-10-03T09:30:00',
        quality: 'suspect',
        isSample: true,
      })
      .expect(201);

    expect(posted.body.deviceId).toBe('hh-gateway-co2');
    expect(posted.body.unit).toBe('ppm');
    expect(posted.body.quality).toBe('suspect');
    expect(posted.body.recordedAt).toBe('2026-10-03T16:30:00.000Z');
    expect(posted.body.isSample).toBe(false);
    expect(posted.body.value).toBe(980);

    await request(app.getHttpServer())
      .post(`/adapters/environment/gateways/${gatewayAId}/readings`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomId: fixture.roomAId,
        deviceId: 'hh-gateway-temp',
        metric: 'temperature',
        value: 74.1,
        unit: '°F',
        recordedAt: new Date().toISOString(),
        quality: 'good',
      })
      .expect(201);

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const temperature = room.body.latestReadings.find((row: { metric: string }) => row.metric === 'temperature');
    const humidity = room.body.latestReadings.find((row: { metric: string }) => row.metric === 'relative_humidity');
    expect(temperature).toMatchObject({
      value: 74.1,
      unit: '°F',
      deviceId: 'hh-gateway-temp',
      quality: 'good',
      isSample: false,
      stale: false,
    });
    expect(humidity.stale).toBe(true);
    expect(humidity.value).toBe(58.2);
    expect(room.body.activeAlerts.map((alert: { message: string }) => alert.message)).toContain(
      'Relative humidity is stale. No reading is newer than 60 minutes.',
    );
  });

  it('denies a gateway write across sites', async () => {
    await request(app.getHttpServer())
      .post(`/adapters/environment/gateways/${gatewayAId}/readings`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send(reading(fixture.roomAId))
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('You do not have access to this gateway.');
      });

    await request(app.getHttpServer())
      .post(`/adapters/environment/gateways/${gatewayAId}/readings`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send(reading(fixture.roomBId))
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('This gateway cannot write that room.');
      });

    await request(app.getHttpServer())
      .post(`/adapters/environment/gateways/${gatewayBId}/readings`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(reading(fixture.roomBId))
      .expect(403);

    await request(app.getHttpServer())
      .get('/adapters/environment/gateways/missing-gateway')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });

  function reading(roomId: string) {
    return {
      roomId,
      deviceId: 'cross-site-probe',
      metric: 'temperature',
      value: 70,
      unit: '°F',
      recordedAt: new Date().toISOString(),
      quality: 'good',
    };
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
