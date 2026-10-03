import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';
const STATEMENT = 'This is a readiness check of stored rows. It is not a state certification.';

describe('site coach', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run coach tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    await prisma.sopRecord.create({
      data: {
        organizationId: fixture.organizationId,
        title: 'Temperature check',
        summary: 'Walk the room and record the temperature.',
      },
    });
    await prisma.alertRule.createMany({
      data: [
        { roomId: fixture.roomAId, metric: 'temperature', kind: 'stale' },
        { roomId: fixture.roomAId, metric: 'relative_humidity', kind: 'stale' },
      ],
    });
    await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Open lot',
        cultivar: 'Test cultivar',
        plantCount: 10,
        stage: 'flower',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-10-29T00:00:00.000Z'),
        status: 'active',
      },
    });

    const license = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: `COACH-${Date.now()}`,
        licenseType: 'producer',
        jurisdiction: 'US-CA',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: `COACH-B-${Date.now()}`,
        licenseType: 'producer',
        jurisdiction: 'US-WA',
        sites: { create: { siteId: fixture.siteBId } },
      },
    });
    const strain = await prisma.strain.create({
      data: { organizationId: fixture.organizationId, name: `Coach strain ${Date.now()}` },
    });
    const batch = await prisma.plantBatch.create({
      data: { licenseId: license.id, strainId: strain.id, name: 'Coach batch' },
    });
    await prisma.plant.create({
      data: {
        licenseId: license.id,
        batchId: batch.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: '',
        stage: 'flower',
        status: 'active',
      },
    });
    await prisma.plant.create({
      data: {
        licenseId: license.id,
        batchId: batch.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: 'CA-TAGGED',
        stage: 'flower',
        status: 'active',
      },
    });
    await prisma.plant.create({
      data: {
        licenseId: license.id,
        batchId: batch.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: 'CA-VOID',
        stage: 'flower',
        status: 'active',
        voidedAt: new Date(),
      },
    });
    const imported = await prisma.metrcInventoryImport.create({
      data: {
        licenseId: license.id,
        source: 'stored-file',
        status: 'complete',
        matchedCount: 0,
        discrepancyCount: 1,
        importedAt: new Date(),
      },
    });
    await prisma.metrcDiscrepancy.create({
      data: { importId: imported.id, licenseId: license.id, tag: 'MISSING', kind: 'missing_locally' },
    });
    await prisma.metrcSubmission.create({
      data: {
        licenseId: license.id,
        status: 'pending_review',
        sandboxOutcome: 'success',
        requestedById: actor.id,
        requestedAt: new Date(),
      },
    });
    const missingWaste = await prisma.harvest.create({
      data: { licenseId: license.id, siteId: fixture.siteAId, name: 'Missing waste', roomId: fixture.roomAId },
    });
    const recordedWaste = await prisma.harvest.create({
      data: { licenseId: license.id, siteId: fixture.siteAId, name: 'Recorded waste', roomId: fixture.roomAId },
    });
    await prisma.harvestStep.createMany({
      data: [
        { harvestId: missingWaste.id, kind: 'dry_weight', actorUserId: actor.id, occurredAt: new Date(), weightGrams: 1000 },
        { harvestId: recordedWaste.id, kind: 'dry_weight', actorUserId: actor.id, occurredAt: new Date(), weightGrams: 800 },
      ],
    });
    await prisma.harvestWaste.create({
      data: { harvestId: recordedWaste.id, weightGrams: 40, actorUserId: actor.id, recordedAt: new Date() },
    });
    await prisma.harvestPackage.create({
      data: {
        harvestId: missingWaste.id,
        licenseId: license.id,
        label: 'UNQUEUED',
        weightGrams: 500,
        actorUserId: actor.id,
        recordedAt: new Date(),
      },
    });

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

  it('quotes stored figures, creates one SOP-linked alert task, and lists readiness for the license jurisdiction', async () => {
    const first = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/coach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(first.body.statement).toBe(STATEMENT);
    expect(first.body.siteName).toBe('Site A');
    expect(first.body.helper.rooms.map((room: { name: string }) => room.name)).toContain('Room A');
    expect(first.body.helper.sops.map((sop: { title: string }) => sop.title)).toContain('Temperature check');
    expect(first.body.helper.people.length).toBeGreaterThan(0);
    expect(first.body.cycles).toHaveLength(1);
    expect(first.body.cycles[0]).toMatchObject({
      cultivar: 'Test cultivar',
      yield: { present: false, absentReason: 'This cycle has not been harvested, so yield is absent.' },
      labor: { lines: [], formula: expect.stringContaining('Labor cost') },
      inputs: { lines: [], formula: expect.stringContaining('Input cost') },
    });
    expect(first.body.cycles[0].totalCostFormula).toContain('Total cost');
    expect(first.body.cycles[0].duration.formula).toEqual(expect.any(String));

    const notices = first.body.notices as Array<{ roomName: string; taskTitle: string; sopTitle: string | null; message: string }>;
    const temperature = notices.find((notice) => notice.taskTitle === 'Room A: Temperature alert');
    const humidity = notices.find((notice) => notice.taskTitle === 'Room A: Relative humidity alert');
    expect(temperature).toMatchObject({
      roomName: 'Room A',
      sopTitle: 'Temperature check',
      message: expect.stringContaining('Temperature is stale'),
    });
    expect(humidity).toMatchObject({ roomName: 'Room A', sopTitle: null });

    const tasks = await prisma.roomTask.findMany({
      where: { roomId: fixture.roomAId, sourceAlertId: { not: null } },
      include: { assignees: true, sopRecord: true },
    });
    expect(tasks).toHaveLength(2);
    const temperatureTask = tasks.find((task) => task.title === 'Room A: Temperature alert');
    expect(temperatureTask?.sopRecord?.title).toBe('Temperature check');
    expect(temperatureTask?.description).toContain('Walk the room and record the temperature.');
    const assigneeIds = new Set(temperatureTask?.assignees.map((row) => row.userId));
    const siteAUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const siteBUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteBUser.email } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixture.adminUser.email } });
    expect(assigneeIds.has(siteAUser.id)).toBe(true);
    expect(assigneeIds.has(admin.id)).toBe(true);
    expect(assigneeIds.has(siteBUser.id)).toBe(false);

    const second = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/coach`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(second.body.notices).toHaveLength(notices.length);
    expect(await prisma.roomTask.count({ where: { roomId: fixture.roomAId, sourceAlertId: { not: null } } })).toBe(2);

    expect(first.body.licenses).toHaveLength(1);
    expect(first.body.licenses[0].jurisdiction).toBe('US-CA');
    const gaps = Object.fromEntries(
      (first.body.licenses[0].gaps as Array<{ kind: string; count: number }>).map((gap) => [gap.kind, gap.count]),
    );
    expect(gaps).toEqual({
      untagged_plants: 1,
      discrepancies: 1,
      pending_submissions: 1,
      unqueued_packages: 1,
      missing_waste: 1,
    });

    const matched = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/coach/ask`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ question: 'How do I check temperature?' })
      .expect(201);
    expect(matched.body).toMatchObject({
      matched: true,
      title: 'Temperature check',
      summary: 'Walk the room and record the temperature.',
      message: 'Walk the room and record the temperature.',
    });
    const unmatched = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/coach/ask`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ question: 'zzzzqqqq' })
      .expect(201);
    expect(unmatched.body).toEqual({
      matched: false,
      title: null,
      summary: null,
      message: 'No stored procedure matches that question.',
    });

    const chatAsk = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/coach/chat`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'How do I check temperature?' })
      .expect(201);
    expect(chatAsk.body).toMatchObject({
      reply: expect.stringContaining('Temperature check'),
      matchedSopTitle: 'Temperature check',
      actions: [],
    });

    const generated = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/coach/chat`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Generate tasks for Temperature check' })
      .expect(201);
    expect(generated.body.actions.length).toBeGreaterThan(0);
    expect(generated.body.actions[0]).toMatchObject({
      type: 'task',
      title: 'Temperature check',
      roomName: 'Room A',
      sopTitle: 'Temperature check',
    });
    expect(
      await prisma.roomTask.count({
        where: { roomId: fixture.roomAId, title: 'Temperature check', sourceAlertId: null },
      }),
    ).toBe(1);

    const trained = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/coach/chat`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ message: 'Train workers on Temperature check' })
      .expect(201);
    expect(trained.body.actions.length).toBeGreaterThan(0);
    expect(trained.body.actions[0]).toMatchObject({
      type: 'training',
      sopTitle: 'Temperature check',
      title: 'Temperature check training',
    });
    expect(
      await prisma.trainingRecord.count({
        where: { siteId: fixture.siteAId, sopTitle: 'Temperature check', status: 'assigned' },
      }),
    ).toBe(trained.body.actions.length);

    await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/coach`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    const workspaceA = await request(app.getHttpServer())
      .get('/workspace/today')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(workspaceA.body.notices.some((notice: { siteName: string }) => notice.siteName === 'Site A')).toBe(true);
    expect(workspaceA.body.notices.some((notice: { siteName: string }) => notice.siteName === 'Site B')).toBe(false);

    const workspaceB = await request(app.getHttpServer())
      .get('/workspace/today')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(workspaceB.body.notices.some((notice: { siteName: string }) => notice.siteName === 'Site A')).toBe(false);

    const adminCoach = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteBId}/coach`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(adminCoach.body.licenses[0].jurisdiction).toBe('US-WA');
    expect(adminCoach.body.statement).toBe(STATEMENT);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
