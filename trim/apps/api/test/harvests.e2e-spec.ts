import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('harvest and packages', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let cycleAId = '';
  let cycleBId = '';
  let tagA1 = '';
  let tagA2 = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run harvest tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const licenseA = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'HARVEST-A',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    const licenseB = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'HARVEST-B',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteBId } },
      },
    });
    const strain = await prisma.strain.create({
      data: { organizationId: fixture.organizationId, name: 'Harvest strain' },
    });
    const batchA = await prisma.plantBatch.create({
      data: { licenseId: licenseA.id, strainId: strain.id, name: 'Harvest batch A' },
    });
    const batchB = await prisma.plantBatch.create({
      data: { licenseId: licenseB.id, strainId: strain.id, name: 'Harvest batch B' },
    });
    const cycleA = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Cedar test',
        cultivar: 'Cedar',
        plantCount: 2,
        stage: 'flower',
        startDate: new Date('2026-09-12T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-10-24T00:00:00.000Z'),
        status: 'active',
      },
    });
    const cycleB = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomBId,
        name: 'Glass test',
        cultivar: 'Glass',
        plantCount: 1,
        stage: 'veg',
        startDate: new Date('2026-09-20T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-11-15T00:00:00.000Z'),
        status: 'active',
      },
    });
    cycleAId = cycleA.id;
    cycleBId = cycleB.id;
    tagA1 = 'HARVEST-A-1';
    tagA2 = 'HARVEST-A-2';
    await prisma.plant.createMany({
      data: [
        {
          licenseId: licenseA.id,
          batchId: batchA.id,
          strainId: strain.id,
          cycleId: cycleA.id,
          roomId: fixture.roomAId,
          tag: tagA1,
          stage: 'flower',
          status: 'active',
        },
        {
          licenseId: licenseA.id,
          batchId: batchA.id,
          strainId: strain.id,
          cycleId: cycleA.id,
          roomId: fixture.roomAId,
          tag: tagA2,
          stage: 'flower',
          status: 'active',
        },
        {
          licenseId: licenseB.id,
          batchId: batchB.id,
          strainId: strain.id,
          cycleId: cycleB.id,
          roomId: fixture.roomBId,
          tag: 'HARVEST-B-1',
          stage: 'veg',
          status: 'active',
        },
      ],
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

  it('traces a package to harvested tags, records the waste actor, and accounts for dry weight', async () => {
    const harvest = await request(app.getHttpServer())
      .post('/harvests')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ cycleId: cycleAId })
      .expect(201);
    expect(harvest.body.plants.map((plant: { tag: string }) => plant.tag).sort()).toEqual([tagA1, tagA2].sort());
    const harvestId = harvest.body.id as string;

    await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/wet-weight`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ grams: 2000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/drying`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/dry-weight`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ grams: 1000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/trimming`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
      .expect(201);

    const tooHeavy = await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/waste`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ grams: 1001, note: 'Too much' })
      .expect(400);
    expect(tooHeavy.body.message).toContain('Dry 1000 g');

    const wasted = await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/waste`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ grams: 150, note: 'Fan leaves' })
      .expect(201);
    const wasteRow = wasted.body.wastes[0];
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const storedWaste = await prisma.harvestWaste.findUniqueOrThrow({ where: { id: wasteRow.id } });
    expect(wasteRow.actorName).toBe('Site A Operator');
    expect(storedWaste.actorUserId).toBe(actor.id);
    expect(storedWaste.harvestId).toBe(harvestId);

    const missing = await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/packages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'PKG-MISSING', grams: 100, tags: ['NOT-ON-HARVEST'] })
      .expect(400);
    expect(missing.body.message).toContain('not on this harvest');

    const packaged = await request(app.getHttpServer())
      .post(`/harvests/${harvestId}/packages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ label: 'PKG-A', grams: 850, tags: [tagA1, tagA2] })
      .expect(201);
    expect(packaged.body.sourceTags.map((source: { tag: string }) => source.tag).sort()).toEqual([tagA1, tagA2].sort());
    expect(packaged.body.harvestId).toBe(harvestId);
    expect(packaged.body.ledger.dryWeightGrams).toBe(1000);
    expect(packaged.body.ledger.packageWeightGrams).toBe(850);
    expect(packaged.body.ledger.wasteWeightGrams).toBe(150);
    expect(packaged.body.ledger.unaccountedGrams).toBe(0);
    expect(
      packaged.body.ledger.packageWeightGrams + packaged.body.ledger.wasteWeightGrams + packaged.body.ledger.unaccountedGrams,
    ).toBe(packaged.body.ledger.dryWeightGrams);

    const queued = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ packageId: packaged.body.id, sandboxOutcome: 'success' })
      .expect(201);
    expect(queued.body.status).toBe('pending_review');
    expect(queued.body.packageLabel).toBe('PKG-A');
    expect(await prisma.metrcOutbox.count({ where: { submissionId: queued.body.id } })).toBe(0);
  });

  it('denies harvest, waste, and package reads across sites and licenses', async () => {
    const harvestA = await request(app.getHttpServer())
      .get('/harvests')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const harbor = harvestA.body.find((row: { name: string }) => row.name === 'Cedar test harvest');
    expect(harbor).toBeTruthy();

    const createdB = await request(app.getHttpServer())
      .post('/harvests')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ cycleId: cycleBId })
      .expect(201);

    await request(app.getHttpServer()).get(`/harvests/${harbor.id}`).set('Authorization', `Bearer ${tokenB}`).expect(403);
    await request(app.getHttpServer()).get(`/harvests/${createdB.body.id}`).set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer()).get(`/harvests/${harbor.id}/waste`).set('Authorization', `Bearer ${tokenB}`).expect(403);

    const packageId = (
      await prisma.harvestPackage.findFirstOrThrow({ where: { harvestId: harbor.id } })
    ).id;
    await request(app.getHttpServer()).get(`/packages/${packageId}`).set('Authorization', `Bearer ${tokenA}`).expect(200);
    await request(app.getHttpServer()).get(`/packages/${packageId}`).set('Authorization', `Bearer ${tokenB}`).expect(403);
    await request(app.getHttpServer()).get(`/harvests/${harbor.id}`).set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
    await request(app.getHttpServer()).get(`/harvests/${createdB.body.id}`).set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    if (response.status !== 200) {
      return '';
    }
    return response.body.accessToken as string;
  }
});
