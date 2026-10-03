import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('harvest scale adapter', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let harvestAId = '';
  let harvestBId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run scale adapter tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const actorB = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteBUser.email } });
    harvestAId = await seedLedger(prisma, {
      organizationId: fixture.organizationId,
      siteId: fixture.siteAId,
      actorUserId: actor.id,
      licenseNumber: `SCALE-A-${Date.now()}`,
      label: `SCALE-PKG-A-${Date.now()}`,
    });
    harvestBId = await seedLedger(prisma, {
      organizationId: fixture.organizationId,
      siteId: fixture.siteBId,
      actorUserId: actorB.id,
      licenseNumber: `SCALE-B-${Date.now()}`,
      label: `SCALE-PKG-B-${Date.now()}`,
    });
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

  it('stores a sample weight and leaves the harvest ledger unchanged', async () => {
    const before = await request(app.getHttpServer())
      .get(`/harvests/${harvestAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(before.body.ledger).toMatchObject({
      wetWeightGrams: 18240,
      dryWeightGrams: 4120,
      packageWeightGrams: 3600,
      wasteWeightGrams: 240,
      unaccountedGrams: 280,
    });

    await request(app.getHttpServer())
      .post(`/adapters/scales/harvests/${harvestAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'hh-sample-scale',
        weightGrams: 510,
        unit: 'g',
        recordedAt: '2026-10-03T09:30:00',
        quality: 'good',
        isSample: false,
      })
      .expect(400);

    const posted = await request(app.getHttpServer())
      .post(`/adapters/scales/harvests/${harvestAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'hh-sample-scale',
        weightGrams: 510,
        unit: 'g',
        recordedAt: '2026-10-03T09:30:00',
        quality: 'good',
      })
      .expect(201);
    expect(posted.body).toMatchObject({
      deviceId: 'hh-sample-scale',
      weightGrams: 510,
      unit: 'g',
      recordedAt: '2026-10-03T16:30:00.000Z',
      quality: 'good',
      isSample: true,
    });

    const after = await request(app.getHttpServer())
      .get(`/harvests/${harvestAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(after.body.ledger).toEqual(before.body.ledger);

    const listed = await request(app.getHttpServer())
      .get(`/adapters/scales/harvests/${harvestAId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listed.body).toEqual([
      expect.objectContaining({
        deviceId: 'hh-sample-scale',
        weightGrams: 510,
        unit: 'g',
        quality: 'good',
        isSample: true,
      }),
    ]);
    expect(await prisma.harvestStep.count({ where: { harvestId: harvestAId } })).toBe(4);
    expect(await prisma.harvestWaste.count({ where: { harvestId: harvestAId } })).toBe(1);
    expect(await prisma.harvestPackage.count({ where: { harvestId: harvestAId } })).toBe(1);
  });

  it('denies a scale sample from another site', async () => {
    await request(app.getHttpServer())
      .post(`/adapters/scales/harvests/${harvestBId}/samples`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        deviceId: 'other-scale',
        weightGrams: 100,
        unit: 'g',
        recordedAt: new Date().toISOString(),
        quality: 'good',
      })
      .expect(403)
      .expect((response) => {
        expect(response.body.message).toBe('You do not have access to this scale.');
      });

    await request(app.getHttpServer())
      .post(`/adapters/scales/harvests/${harvestAId}/samples`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        deviceId: 'other-scale',
        weightGrams: 100,
        unit: 'g',
        recordedAt: new Date().toISOString(),
        quality: 'good',
      })
      .expect(403);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});

async function seedLedger(
  prisma: PrismaClient,
  input: { organizationId: string; siteId: string; actorUserId: string; licenseNumber: string; label: string },
) {
  const license = await prisma.license.create({
    data: {
      organizationId: input.organizationId,
      licenseNumber: input.licenseNumber,
      licenseType: 'producer',
      jurisdiction: 'US-OR',
      sites: { create: { siteId: input.siteId } },
    },
  });
  const harvest = await prisma.harvest.create({
    data: {
      licenseId: license.id,
      siteId: input.siteId,
      name: 'Scale ledger harvest',
    },
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
    data: {
      harvestId: harvest.id,
      weightGrams: 240,
      actorUserId: input.actorUserId,
      recordedAt: at,
    },
  });
  await prisma.harvestPackage.create({
    data: {
      harvestId: harvest.id,
      licenseId: license.id,
      label: input.label,
      weightGrams: 3600,
      actorUserId: input.actorUserId,
      recordedAt: at,
    },
  });
  return harvest.id;
}
