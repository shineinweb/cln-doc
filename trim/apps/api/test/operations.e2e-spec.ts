import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('floor operations', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let harvestId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run operations tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.adminUser.email } });
    harvestId = await seedLedger(prisma, {
      organizationId: fixture.organizationId,
      siteId: fixture.siteAId,
      actorUserId: actor.id,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    tokenA = await login(app, fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(app, fixture.siteBUser.email, fixture.siteBUser.password);
    tokenAdmin = await login(app, fixture.adminUser.email, fixture.adminUser.password);
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

  it('keeps irrigation on the facility the user can open', async () => {
    await request(app.getHttpServer())
      .post(`/operations/sites/${fixture.siteAId}/irrigation`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomId: fixture.roomAId,
        recordedOn: '2026-10-02',
        kind: 'feed',
        method: 'Drip',
        volumeLiters: 12,
        ec: 1.8,
        ph: 5.9,
        nutrientName: 'Flower nutrients',
      })
      .expect(201);

    const denied = await request(app.getHttpServer())
      .get(`/operations/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this site');

    const opened = await request(app.getHttpServer())
      .get(`/operations/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(opened.body.irrigation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomName: 'Room A',
          kind: 'feed',
          method: 'Drip',
          volumeLiters: 12,
          nutrientName: 'Flower nutrients',
        }),
      ]),
    );
    const other = await request(app.getHttpServer())
      .get(`/operations/sites/${fixture.siteBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    expect(other.body.irrigation).toBeUndefined();
  });

  it('moves a weekly recurring task forward by seven days', async () => {
    const created = await request(app.getHttpServer())
      .post(`/operations/sites/${fixture.siteAId}/recurring`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        roomId: fixture.roomAId,
        title: 'Check drip lines',
        cadence: 'weekly',
        nextDueOn: '2026-10-04',
        assigneeLabel: 'Site A Operator',
        sopTitle: 'Irrigation pass',
      })
      .expect(201);
    const completed = await request(app.getHttpServer())
      .post(`/operations/sites/${fixture.siteAId}/recurring/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(completed.body.nextDueOn).toBe('2026-10-11');
    await request(app.getHttpServer())
      .post(`/operations/sites/${fixture.siteAId}/recurring/${created.body.id}/complete`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it('stores a cultivar and medium on a workflow template and lists the linked procedure', async () => {
    const sop = await request(app.getHttpServer())
      .post('/workflows/sops')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: `Irrigation pass ${Date.now()}`, summary: 'Record volume, EC, and pH.' })
      .expect(201);
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: fixture.organizationId, key: 'site_operator' },
    });
    const created = await request(app.getHttpServer())
      .post('/workflows/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: `Cedar coco ${Date.now()}`,
        cultivar: 'Cedar Nights',
        medium: 'coco',
        durationDays: 28,
        startingEvent: 'cycle_start',
        tasks: [
          {
            taskKey: 'runoff',
            title: 'Check runoff',
            offsetDays: 0,
            assigneeType: 'role',
            roleId: role.id,
            instructions: 'Check runoff.',
            checklist: ['Record the result'],
            sopRecordId: sop.body.id,
            requiresNotes: true,
            requiresMeasurement: false,
            requiresPhoto: false,
            requiresSignOff: false,
            requiresApproval: false,
          },
        ],
      })
      .expect(201);
    expect(created.body.cultivar).toBe('Cedar Nights');
    expect(created.body.medium).toBe('coco');

    const library = await request(app.getHttpServer())
      .get('/operations/sop-library')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(library.body.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: sop.body.title,
          templateTasks: [expect.objectContaining({ taskTitle: 'Check runoff', cultivar: 'Cedar Nights', medium: 'coco' })],
        }),
      ]),
    );
  });

  it('stores a sample tag without changing the harvest ledger', async () => {
    const before = await request(app.getHttpServer())
      .get(`/harvests/${harvestId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(before.body.ledger).toMatchObject({
      wetWeightGrams: 18240,
      dryWeightGrams: 4120,
      packageWeightGrams: 3600,
      wasteWeightGrams: 240,
      unaccountedGrams: 280,
    });

    await request(app.getHttpServer())
      .post(`/adapters/tags/harvests/${harvestId}/samples`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        deviceId: 'hh-sample-rfid',
        tag: '1A4HH000000000000000001',
        recordedAt: '2026-10-03T09:40:00',
        quality: 'good',
      })
      .expect(403);

    const stored = await request(app.getHttpServer())
      .post(`/adapters/tags/harvests/${harvestId}/samples`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        deviceId: 'hh-sample-rfid',
        tag: '1A4HH000000000000000001',
        recordedAt: '2026-10-03T09:40:00',
        quality: 'good',
        isSample: true,
      })
      .expect(201);
    expect(stored.body.isSample).toBe(true);

    const after = await request(app.getHttpServer())
      .get(`/harvests/${harvestId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(after.body.ledger).toEqual(before.body.ledger);
    expect(after.body.plantCount).toBe(before.body.plantCount);
    expect(after.body.steps).toHaveLength(before.body.steps.length);
  });
});

async function login(app: INestApplication, email: string, password: string): Promise<string> {
  const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
  return response.body.accessToken as string;
}

async function seedLedger(
  prisma: PrismaClient,
  input: { organizationId: string; siteId: string; actorUserId: string },
): Promise<string> {
  const license = await prisma.license.create({
    data: {
      organizationId: input.organizationId,
      licenseNumber: `OPS-${Date.now()}`,
      licenseType: 'cultivation',
      jurisdiction: 'OR',
      sites: { create: { siteId: input.siteId } },
    },
  });
  const harvest = await prisma.harvest.create({
    data: { licenseId: license.id, siteId: input.siteId, name: 'Operations ledger harvest' },
  });
  const at = new Date('2026-10-03T16:00:00.000Z');
  await prisma.harvestStep.createMany({
    data: [
      { harvestId: harvest.id, kind: 'wet_weight', actorUserId: input.actorUserId, occurredAt: at, weightGrams: 18240 },
      { harvestId: harvest.id, kind: 'drying', actorUserId: input.actorUserId, occurredAt: at },
      { harvestId: harvest.id, kind: 'dry_weight', actorUserId: input.actorUserId, occurredAt: at, weightGrams: 4120 },
      { harvestId: harvest.id, kind: 'trimming', actorUserId: input.actorUserId, occurredAt: at },
    ],
  });
  await prisma.harvestWaste.create({
    data: { harvestId: harvest.id, weightGrams: 240, actorUserId: input.actorUserId, recordedAt: at },
  });
  await prisma.harvestPackage.create({
    data: {
      harvestId: harvest.id,
      licenseId: license.id,
      label: `OPS-PKG-${Date.now()}`,
      weightGrams: 3600,
      actorUserId: input.actorUserId,
      recordedAt: at,
    },
  });
  return harvest.id;
}
