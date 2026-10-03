import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

function expectedCycleDay(startDateKey: string, timeZone: string, now = new Date()): number {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = Date.parse(`${startDateKey}T00:00:00.000Z`);
  const today = Date.parse(`${todayKey}T00:00:00.000Z`);
  return Math.round((today - start) / 86_400_000) + 1;
}

describe('crop cycles', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let cycleAId = '';
  let cycleBId = '';
  let otherCycleId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run cycle tests against ${process.env.DATABASE_URL}`);
    }

    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.site.update({
      where: { id: fixture.siteAId },
      data: { timezone: 'America/Los_Angeles' },
    });
    await prisma.site.update({
      where: { id: fixture.siteBId },
      data: { timezone: 'America/Los_Angeles' },
    });

    const cycleA = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Site A flower',
        cultivar: 'Test Cultivar A',
        plantCount: 40,
        stage: 'flower',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-11-01T00:00:00.000Z'),
        status: 'active',
        events: {
          create: {
            occurredOn: new Date('2026-09-01T00:00:00.000Z'),
            title: 'Opened A',
            detail: 'Counted in',
          },
        },
        movements: {
          create: {
            occurredOn: new Date('2026-09-02T00:00:00.000Z'),
            fromLabel: 'Bench',
            toLabel: 'Room A',
            plantCount: 40,
          },
        },
        observations: {
          create: {
            occurredOn: new Date('2026-09-03T00:00:00.000Z'),
            authorName: 'Tester',
            body: 'Looks even',
          },
        },
        laborEntries: {
          create: {
            occurredOn: new Date('2026-09-04T00:00:00.000Z'),
            personName: 'Tester',
            hours: 2.5,
            note: 'Scout',
          },
        },
      },
    });
    const cycleB = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomBId,
        name: 'Site B veg',
        cultivar: 'Test Cultivar B',
        plantCount: 18,
        stage: 'veg',
        startDate: new Date('2026-09-10T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-11-20T00:00:00.000Z'),
        status: 'active',
        events: {
          create: {
            occurredOn: new Date('2026-09-10T00:00:00.000Z'),
            title: 'Opened B',
            detail: 'Site B only',
          },
        },
      },
    });
    const otherCycle = await prisma.cropCycle.create({
      data: {
        roomId: fixture.otherRoomId,
        name: 'Other cycle',
        cultivar: 'Other Cultivar',
        plantCount: 4,
        stage: 'dry',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-10-01T00:00:00.000Z'),
        status: 'active',
      },
    });
    cycleAId = cycleA.id;
    cycleBId = cycleB.id;
    otherCycleId = otherCycle.id;

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

  it('rejects unauthenticated cycle reads', async () => {
    await request(app.getHttpServer()).get(`/cycles/${cycleAId}`).expect(401);
  });

  it('builds facility and room payloads from the stored cycle', async () => {
    const stored = await prisma.cropCycle.findUniqueOrThrow({ where: { id: cycleAId } });
    const sites = await request(app.getHttpServer())
      .get('/sites')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const listed = sites.body[0].rooms.find((room: { id: string }) => room.id === fixture.roomAId);
    expect(listed.currentCycle.cultivar).toBe(stored.cultivar);
    expect(listed.currentCycle.plantCount).toBe(stored.plantCount);
    expect(listed.currentCycle.name).toBe(stored.name);
    expect(listed.currentCycle.expectedHarvestDate).toBe(stored.expectedHarvestDate.toISOString().slice(0, 10));
    expect(listed.currentCycle.startDate).toBe(stored.startDate.toISOString().slice(0, 10));

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.currentCycle.id).toBe(stored.id);
    expect(room.body.currentCycle.cultivar).toBe(stored.cultivar);
    expect(room.body.currentCycle.plantCount).toBe(stored.plantCount);
    expect(room.body.operatingHistory.events.map((event: { title: string }) => event.title)).toEqual(['Opened A']);
    expect(room.body.operatingHistory.laborEntries[0].hours).toBe(2.5);
    expect(room.body.operatingHistory.harvestSummary).toBeNull();
    expect(room.body.tasksDueToday).toEqual([]);
    expect(room.body.activeAlerts).toEqual([]);
    expect(room.body.latestReadings).toEqual([]);
    expect(room.body.lastMetrcSync).toBeNull();
  });

  it('derives cycle day from the start date in the site timezone', async () => {
    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const cycle = room.body.currentCycle as { startDate: string; cycleDay: number };
    expect(cycle.cycleDay).toBe(expectedCycleDay(cycle.startDate, 'America/Los_Angeles'));
    expect(cycle.cycleDay).toBeGreaterThan(1);
  });

  it('denies site A the site B cycle and its history', async () => {
    await request(app.getHttpServer())
      .get(`/cycles/${cycleBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    const own = await request(app.getHttpServer())
      .get(`/cycles/${cycleAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(own.body.cultivar).toBe('Test Cultivar A');
    expect(own.body.operatingHistory.events[0].title).toBe('Opened A');
    expect(own.body.operatingHistory.movements[0].toLabel).toBe('Room A');
  });

  it('denies site B the site A cycle and lets the admin read both', async () => {
    await request(app.getHttpServer())
      .get(`/cycles/${cycleAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    const siteBCycle = await request(app.getHttpServer())
      .get(`/cycles/${cycleBId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const siteACycle = await request(app.getHttpServer())
      .get(`/cycles/${cycleAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(siteBCycle.body.operatingHistory.events[0].title).toBe('Opened B');
    expect(siteACycle.body.cultivar).toBe('Test Cultivar A');
    expect(siteBCycle.body.cycleDay).toBe(expectedCycleDay(siteBCycle.body.startDate, 'America/Los_Angeles'));
  });

  it('hides a cycle that belongs to another organization', async () => {
    await request(app.getHttpServer())
      .get(`/cycles/${otherCycleId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
