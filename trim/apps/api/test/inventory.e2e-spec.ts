import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('inventory and metrc import', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let licenseAId = '';
  let licenseBId = '';
  let otherLicenseId = '';
  let plantAId = '';
  let plantBId = '';
  let roomA2Id = '';
  const secret = 'secret-metrc-key';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run inventory tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);

    const licenseA = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'LIC-A',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    const licenseB = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'LIC-B',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteBId } },
      },
    });
    const otherLicense = await prisma.license.create({
      data: {
        organizationId: fixture.otherOrganizationId,
        licenseNumber: 'LIC-OTHER',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.otherSiteId } },
      },
    });
    await prisma.metrcConnection.create({
      data: {
        licenseId: licenseA.id,
        userKey: secret,
        integratorKey: 'integrator-secret',
        baseUrl: 'https://api-or.metrc.example',
      },
    });
    const strain = await prisma.strain.create({
      data: { organizationId: fixture.organizationId, name: 'Inventory strain' },
    });
    const batchA = await prisma.plantBatch.create({
      data: { licenseId: licenseA.id, strainId: strain.id, name: 'Batch A' },
    });
    const batchB = await prisma.plantBatch.create({
      data: { licenseId: licenseB.id, strainId: strain.id, name: 'Batch B' },
    });
    const roomA2 = await prisma.room.create({
      data: { siteId: fixture.siteAId, name: 'Room A2', code: 'RA2', roomType: 'flower' },
    });
    const plantA = await prisma.plant.create({
      data: {
        licenseId: licenseA.id,
        batchId: batchA.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: 'T-A-1',
        stage: 'veg',
        status: 'active',
      },
    });
    await prisma.plant.create({
      data: {
        licenseId: licenseA.id,
        batchId: batchA.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: 'T-A-2',
        stage: 'veg',
        status: 'active',
      },
    });
    const plantB = await prisma.plant.create({
      data: {
        licenseId: licenseB.id,
        batchId: batchB.id,
        strainId: strain.id,
        roomId: fixture.roomBId,
        tag: 'T-B-1',
        stage: 'veg',
        status: 'active',
      },
    });
    await prisma.plant.create({
      data: {
        licenseId: licenseB.id,
        batchId: batchB.id,
        strainId: strain.id,
        roomId: fixture.roomBId,
        tag: 'T-B-2',
        stage: 'veg',
        status: 'active',
      },
    });

    licenseAId = licenseA.id;
    licenseBId = licenseB.id;
    otherLicenseId = otherLicense.id;
    plantAId = plantA.id;
    plantBId = plantB.id;
    roomA2Id = roomA2.id;

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

  it('reconciles a clean import to zero discrepancies without changing plants', async () => {
    const before = await prisma.plant.findMany({ where: { licenseId: licenseAId }, orderBy: { tag: 'asc' } });
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Metrc must not be called'));
    const response = await request(app.getHttpServer())
      .post(`/licenses/${licenseAId}/imports`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        LicenseNumber: 'LIC-A',
        Plants: [
          { Label: 'T-A-1', StrainName: 'Inventory strain', GrowthPhase: 'Vegetative' },
          { Label: 'T-A-2', StrainName: 'Inventory strain', GrowthPhase: 'Vegetative' },
        ],
      })
      .expect(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    expect(response.body.matchedCount).toBe(2);
    expect(response.body.discrepancyCount).toBe(0);
    expect(response.body.discrepancies).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain(secret);

    const after = await prisma.plant.findMany({ where: { licenseId: licenseAId }, orderBy: { tag: 'asc' } });
    expect(after.map((plant) => plant.tag)).toEqual(before.map((plant) => plant.tag));
    expect(after.map((plant) => plant.roomId)).toEqual(before.map((plant) => plant.roomId));
  });

  it('reports an extra tag on the other license and leaves the first license alone', async () => {
    const beforeA = await prisma.plant.findMany({ where: { licenseId: licenseAId }, orderBy: { tag: 'asc' } });
    const beforeB = await prisma.plant.findMany({ where: { licenseId: licenseBId }, orderBy: { tag: 'asc' } });
    const response = await request(app.getHttpServer())
      .post(`/licenses/${licenseBId}/imports`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        LicenseNumber: 'LIC-B',
        Plants: [
          { Label: 'T-B-1', StrainName: 'Inventory strain', GrowthPhase: 'Vegetative' },
          { Label: 'T-B-2', StrainName: 'Inventory strain', GrowthPhase: 'Vegetative' },
          { Label: 'T-B-EXTRA', StrainName: 'Inventory strain', GrowthPhase: 'Vegetative' },
        ],
      })
      .expect(201);
    expect(response.body.matchedCount).toBe(2);
    expect(response.body.discrepancyCount).toBe(1);
    expect(response.body.discrepancies).toEqual([expect.objectContaining({ tag: 'T-B-EXTRA', kind: 'extra_tag' })]);

    const afterA = await prisma.plant.findMany({ where: { licenseId: licenseAId }, orderBy: { tag: 'asc' } });
    const afterB = await prisma.plant.findMany({ where: { licenseId: licenseBId }, orderBy: { tag: 'asc' } });
    expect(afterA.map((plant) => [plant.tag, plant.updatedAt.toISOString()])).toEqual(
      beforeA.map((plant) => [plant.tag, plant.updatedAt.toISOString()]),
    );
    expect(afterB.map((plant) => plant.tag)).toEqual(beforeB.map((plant) => plant.tag));
    expect(afterB.map((plant) => plant.tag)).not.toContain('T-B-EXTRA');

    const overview = await request(app.getHttpServer())
      .get('/compliance')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const licenseA = overview.body.licenses.find((license: { id: string }) => license.id === licenseAId);
    const licenseB = overview.body.licenses.find((license: { id: string }) => license.id === licenseBId);
    expect(licenseA.latestImport.discrepancyCount).toBe(0);
    expect(licenseB.latestImport.discrepancyCount).toBe(1);
    expect(JSON.stringify(overview.body)).not.toContain(secret);
  });

  it('denies cross-site and cross-license reads', async () => {
    await request(app.getHttpServer()).get(`/licenses/${licenseBId}`).expect(401);
    await request(app.getHttpServer())
      .get(`/licenses/${licenseBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/plants/${plantBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/licenses/${licenseBId}/imports`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ LicenseNumber: 'LIC-B', Plants: [] })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/licenses/${licenseAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/licenses/${otherLicenseId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/plants/${plantAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);

    const siteA = await request(app.getHttpServer())
      .get('/compliance')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(siteA.body.licenses.map((license: { licenseNumber: string }) => license.licenseNumber)).toEqual(['LIC-A']);

    const own = await request(app.getHttpServer())
      .get(`/licenses/${licenseAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(own.body.plantCount).toBe(2);
    expect(JSON.stringify(own.body)).not.toContain(secret);
  });

  it('writes an actor event when a plant moves', async () => {
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const response = await request(app.getHttpServer())
      .post(`/plants/${plantAId}/moves`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ roomId: roomA2Id })
      .expect(201);
    expect(response.body.roomId).toBe(roomA2Id);
    const event = await prisma.plantEvent.findFirstOrThrow({
      where: { plantId: plantAId, eventType: 'moved' },
    });
    expect(event.actorUserId).toBe(actor.id);
    expect(event.fromRoomId).toBe(fixture.roomAId);
    expect(event.toRoomId).toBe(roomA2Id);
    const stored = await prisma.plant.findUniqueOrThrow({ where: { id: plantAId } });
    expect(stored.roomId).toBe(roomA2Id);

    const stage = await request(app.getHttpServer())
      .post(`/plants/${plantAId}/stages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ stage: 'flower' })
      .expect(201);
    expect(stage.body.events.some((item: { eventType: string; actorName: string }) => item.eventType === 'stage_changed' && item.actorName.length > 0)).toBe(true);

    const note = await request(app.getHttpServer())
      .post(`/plants/${plantAId}/observations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ note: 'Tip burn on the new bench.' })
      .expect(201);
    expect(note.body.events.some((item: { eventType: string; note: string }) => item.eventType === 'observed' && item.note.includes('Tip burn'))).toBe(true);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
