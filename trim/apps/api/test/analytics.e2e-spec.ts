import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('analytics and costs', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run analytics tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const license = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'YIELD-A',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    const strain = await prisma.strain.create({
      data: { organizationId: fixture.organizationId, name: 'Yield strain' },
    });
    const batch = await prisma.plantBatch.create({
      data: { licenseId: license.id, strainId: strain.id, name: 'Yield batch' },
    });
    const cycleA = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Cedar test',
        cultivar: 'Cedar Nights',
        plantCount: 144,
        stage: 'flower',
        startDate: new Date('2026-09-12T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-10-24T00:00:00.000Z'),
        status: 'active',
      },
    });
    await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomBId,
        name: 'Glass test',
        cultivar: 'Glass Orchard',
        plantCount: 86,
        stage: 'veg',
        startDate: new Date('2026-09-20T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-11-15T00:00:00.000Z'),
        status: 'active',
      },
    });
    await prisma.plant.createMany({
      data: Array.from({ length: 144 }, (_, index) => ({
        licenseId: license.id,
        batchId: batch.id,
        strainId: strain.id,
        cycleId: cycleA.id,
        roomId: fixture.roomAId,
        tag: `1A4YIELD${String(index + 1).padStart(16, '0')}`,
        stage: 'flower',
        status: 'active',
      })),
    });
    const plants = await prisma.plant.findMany({ where: { cycleId: cycleA.id }, select: { id: true, tag: true } });
    const harvest = await prisma.harvest.create({
      data: {
        licenseId: license.id,
        siteId: fixture.siteAId,
        cycleId: cycleA.id,
        roomId: fixture.roomAId,
        name: 'Cedar test harvest',
      },
    });
    await prisma.harvestPlant.createMany({
      data: plants.map((plant) => ({ harvestId: harvest.id, plantId: plant.id, tag: plant.tag })),
    });
    await prisma.harvestStep.createMany({
      data: [
        {
          harvestId: harvest.id,
          kind: 'harvested',
          actorUserId: (
            await prisma.user.findFirstOrThrow({ where: { email: fixture.siteAUser.email } })
          ).id,
          occurredAt: new Date('2026-10-03T16:00:00.000Z'),
        },
        {
          harvestId: harvest.id,
          kind: 'wet_weight',
          actorUserId: (await prisma.user.findFirstOrThrow({ where: { email: fixture.siteAUser.email } })).id,
          occurredAt: new Date('2026-10-03T17:00:00.000Z'),
          weightGrams: 18240,
        },
        {
          harvestId: harvest.id,
          kind: 'dry_weight',
          actorUserId: (await prisma.user.findFirstOrThrow({ where: { email: fixture.siteAUser.email } })).id,
          occurredAt: new Date('2026-10-03T19:00:00.000Z'),
          weightGrams: 4120,
        },
      ],
    });
    const actorId = (await prisma.user.findFirstOrThrow({ where: { email: fixture.siteAUser.email } })).id;
    await prisma.harvestWaste.create({
      data: {
        harvestId: harvest.id,
        weightGrams: 240,
        actorUserId: actorId,
        recordedAt: new Date('2026-10-03T21:00:00.000Z'),
      },
    });
    await prisma.harvestPackage.create({
      data: {
        harvestId: harvest.id,
        licenseId: license.id,
        label: '1A4PKGTEST000000000001',
        weightGrams: 3600,
        actorUserId: actorId,
        recordedAt: new Date('2026-10-03T22:00:00.000Z'),
      },
    });
    await prisma.cycleLaborEntry.create({
      data: {
        cycleId: cycleA.id,
        occurredOn: new Date('2026-09-26T00:00:00.000Z'),
        personName: 'Tester',
        hours: 2,
        note: 'Bench work',
      },
    });
    await prisma.laborRate.create({
      data: { organizationId: fixture.organizationId, personName: 'Tester', hourlyCents: 1500 },
    });
    await prisma.environmentalReading.createMany({
      data: [
        {
          roomId: fixture.roomAId,
          deviceId: 'live-temp',
          metric: 'temperature',
          value: 70,
          unit: '°F',
          quality: 'good',
          isSample: false,
          recordedAt: new Date('2026-10-03T16:00:00.000Z'),
        },
        {
          roomId: fixture.roomAId,
          deviceId: 'sample-probe',
          metric: 'co2',
          value: 9999,
          unit: 'ppm',
          quality: 'good',
          isSample: true,
          recordedAt: new Date('2026-10-03T16:00:00.000Z'),
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

  it('computes Cedar Nights grams per plant from dry weight and plant count, and balances the ledger', async () => {
    const report = await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const cedar = report.body.cycles.find((cycle: { cultivar: string }) => cycle.cultivar === 'Cedar Nights');
    expect(cedar.yield.plantCount).toBe(144);
    expect(cedar.yield.dryWeightGrams).toBe(4120);
    expect(cedar.yield.wetWeightGrams).toBe(18240);
    expect(cedar.yield.packageWeightGrams).toBe(3600);
    expect(cedar.yield.wasteWeightGrams).toBe(240);
    expect(cedar.yield.gramsPerPlant).toBeCloseTo(4120 / 144, 10);
    expect(cedar.yield.packageWeightGrams + cedar.yield.wasteWeightGrams + cedar.yield.unaccountedGrams).toBe(
      cedar.yield.dryWeightGrams,
    );
    expect(cedar.yield.gramsPerPlantFormula).toContain('4120');
    expect(cedar.yield.gramsPerPlantFormula).toContain('144');
    expect(cedar.yield.ledgerFormula).toContain('3600');
    expect(cedar.duration.completedDurationDays).toBe(22);
    expect(JSON.stringify(cedar)).not.toContain('9999');
    expect(cedar.excludedSampleReadingCount).toBe(1);
  });

  it('leaves yield absent on an unharvested cycle', async () => {
    const report = await request(app.getHttpServer())
      .get('/reports/comparison')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const glass = report.body.cycles.find((cycle: { cultivar: string }) => cycle.cultivar === 'Glass Orchard');
    expect(glass.yield.present).toBe(false);
    expect(glass.yield.gramsPerPlant).toBeNull();
    expect(glass.yield.absentReason).toContain('has not been harvested');
    expect(glass.duration.completedDurationDays).toBeNull();
    expect(glass.duration.daysSinceStart).toEqual(expect.any(Number));
  });

  it('prices labor as hours times the stored rate', async () => {
    const report = await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const cedar = report.body.cycles.find((cycle: { cultivar: string }) => cycle.cultivar === 'Cedar Nights');
    expect(cedar.labor.lines).toEqual([
      expect.objectContaining({
        personName: 'Tester',
        hours: 2,
        hourlyCents: 1500,
        costCents: 3000,
      }),
    ]);
    expect(cedar.labor.totalCostCents).toBe(3000);
    expect(cedar.labor.formula).toContain('3000');
  });

  it('builds facility dashboard charts from stored harvest, labor, and plant rows', async () => {
    await prisma.cycleInputCost.createMany({
      data: [
        {
          cycleId: (
            await prisma.cropCycle.findFirstOrThrow({
              where: { roomId: fixture.roomAId, cultivar: 'Cedar Nights' },
            })
          ).id,
          description: 'Flower nutrients',
          quantity: 2,
          unit: 'bag',
          unitCostCents: 1500,
        },
        {
          cycleId: (
            await prisma.cropCycle.findFirstOrThrow({
              where: { roomId: fixture.roomAId, cultivar: 'Cedar Nights' },
            })
          ).id,
          description: 'Veg media',
          quantity: 1,
          unit: 'bag',
          unitCostCents: 4200,
        },
      ],
    });

    const denied = await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteAId}/dashboard`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(denied.status).toBe(403);

    const dashboard = await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteAId}/dashboard`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(dashboard.body.siteId).toBe(fixture.siteAId);
    expect(dashboard.body.statement).toContain('does not store sales dollars');
    expect(dashboard.body.yieldGraph.cultivars).toContain('Cedar Nights');
    expect(dashboard.body.yieldGraph.series.some((row: { cultivar: string; points: Array<{ grams: number }> }) =>
      row.cultivar === 'Cedar Nights' && row.points.some((point) => point.grams === 4120),
    )).toBe(true);
    expect(dashboard.body.cogs.laborCents).toBe(3000);
    expect(dashboard.body.cogs.cannabisCents).toBe(3000);
    expect(dashboard.body.cogs.nonCannabisCents).toBe(4200);
    expect(dashboard.body.cogs.totalCents).toBe(10200);
    expect(dashboard.body.topStrains[0]).toMatchObject({
      strainName: 'Cedar Nights',
      harvestCount: 1,
      packagedGrams: 3600,
    });
    expect(dashboard.body.kpis.packagedMtdGrams).toBe(3600);
    expect(dashboard.body.kpis.averageGramsPerPlant).toBeCloseTo(4120 / 144, 5);
    expect(dashboard.body.packagesByItem[0]).toMatchObject({
      label: '1A4PKGTEST000000000001',
      weightGrams: 3600,
    });
    expect(dashboard.body.plantForecast.dates).toHaveLength(4);
    expect(dashboard.body.plantForecast.rows.some((row: { cultivar: string }) => row.cultivar === 'Cedar Nights')).toBe(
      true,
    );
  });

  it('denies a report for another site', async () => {
    await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('You do not have access to this report.');
      });
    await request(app.getHttpServer())
      .get(`/reports/sites/${fixture.siteBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    const own = await request(app.getHttpServer())
      .get('/reports/comparison')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(own.body.cycles.map((cycle: { siteId: string }) => cycle.siteId)).toEqual([fixture.siteAId]);
    const both = await request(app.getHttpServer())
      .get('/reports/comparison')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(new Set(both.body.cycles.map((cycle: { siteId: string }) => cycle.siteId))).toEqual(
      new Set([fixture.siteAId, fixture.siteBId]),
    );
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
