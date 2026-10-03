import { createServer, type Server } from 'node:http';
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

  it('draws a room chart from Trolmaster and keeps the credential off the response', async () => {
    const secret = 'trolmaster-chart-secret';
    const standIn = await listen();
    const previous = process.env.TROLMASTER_API_BASE;
    process.env.TROLMASTER_API_BASE = standIn.url;
    try {
      const saved = await request(app.getHttpServer())
        .post(`/sites/${fixture.siteAId}/trolmaster`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ roomId: fixture.roomAId, controllerId: 'FR5', apiCredential: secret });
      expect(saved.status).toBe(201);

      const denied = await request(app.getHttpServer())
        .get(`/rooms/${fixture.roomBId}/trolmaster/chart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(denied.status).toBe(403);
      expect(denied.body.message).toBe('You do not have access to this site');

      const empty = await request(app.getHttpServer())
        .get(`/rooms/${fixture.roomBId}/trolmaster/chart`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(empty.status).toBe(200);
      expect(empty.body.message).toBe('Save a Trolmaster controller on Trolmaster settings.');
      expect(empty.body.series).toEqual([]);

      const chart = await request(app.getHttpServer())
        .get(`/rooms/${fixture.roomAId}/trolmaster/chart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(chart.status).toBe(200);
      expect(chart.body.controllerId).toBe('FR5');
      expect(chart.body.latest).toEqual([
        expect.objectContaining({ metric: 'ec', label: 'EC PW', value: 4.31, unit: 'dS/m' }),
        expect.objectContaining({ metric: 'vwc', label: 'VWC', value: 21.6, unit: '%' }),
      ]);
      expect(chart.body.series).toHaveLength(2);
      expect(JSON.stringify(chart.body)).not.toContain(secret);
      expect(standIn.requests[0]?.key).toBe(secret);
      expect(standIn.requests[0]?.body).toMatchObject({ cmd: 'getDevices', controllerId: 'FR5' });
    } finally {
      if (previous === undefined) {
        delete process.env.TROLMASTER_API_BASE;
      } else {
        process.env.TROLMASTER_API_BASE = previous;
      }
      await standIn.close();
      await prisma.trolmasterConnection.deleteMany({ where: { roomId: fixture.roomAId } });
    }
  });

  it('uses test mode for the sample chart and does not call Trolmaster', async () => {
    const standIn = await listen();
    const previous = process.env.TROLMASTER_API_BASE;
    process.env.TROLMASTER_API_BASE = standIn.url;
    try {
      const denied = await request(app.getHttpServer())
        .patch(`/rooms/${fixture.roomBId}/trolmaster`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ enabled: true, testMode: true });
      expect(denied.status).toBe(403);
      expect(denied.body.message).toBe('You do not have access to this site');

      const testing = await request(app.getHttpServer())
        .patch(`/rooms/${fixture.roomAId}/trolmaster`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ enabled: true, testMode: true });
      expect(testing.status).toBe(200);
      expect(testing.body).toEqual({ enabled: true, testMode: true });

      const chart = await request(app.getHttpServer())
        .get(`/rooms/${fixture.roomAId}/trolmaster/chart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(chart.status).toBe(200);
      expect(chart.body.enabled).toBe(true);
      expect(chart.body.testMode).toBe(true);
      expect(chart.body.series).toEqual([]);
      expect(chart.body.message).toBe('Sample readings. Trim is not calling Trolmaster.');
      expect(standIn.requests).toEqual([]);

      const off = await request(app.getHttpServer())
        .patch(`/rooms/${fixture.roomAId}/trolmaster`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ enabled: false, testMode: true });
      expect(off.status).toBe(200);
      expect(off.body).toEqual({ enabled: false, testMode: false });

      const hidden = await request(app.getHttpServer())
        .get(`/rooms/${fixture.roomAId}/trolmaster/chart`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(hidden.body.message).toBe('Trolmaster is off.');
      expect(hidden.body.series).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.TROLMASTER_API_BASE;
      } else {
        process.env.TROLMASTER_API_BASE = previous;
      }
      await standIn.close();
      await prisma.room.update({
        where: { id: fixture.roomAId },
        data: { trolmasterEnabled: true, trolmasterTest: false },
      });
    }
  });

  async function listen(): Promise<{ url: string; close: () => Promise<void>; requests: Array<{ key?: string; body: unknown }> }> {
    const requests: Array<{ key?: string; body: unknown }> = [];
    const server: Server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        requests.push({
          key: typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        });
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            series: [
              {
                name: 'EC PW',
                unit: 'dS/m',
                points: [
                  { at: '2026-10-02T14:18:00.000Z', value: 4.1 },
                  { at: '2026-10-02T15:18:00.000Z', value: 4.31 },
                ],
              },
              {
                name: 'VWC',
                unit: '%',
                points: [
                  { at: '2026-10-02T14:18:00.000Z', value: 20 },
                  { at: '2026-10-02T15:18:00.000Z', value: 21.6 },
                ],
              },
            ],
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return {
      url: `http://127.0.0.1:${port}`,
      requests,
      close: () => new Promise((resolve) => server.close(() => resolve())),
    };
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
