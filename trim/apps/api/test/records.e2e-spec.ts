import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('record changes', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run record tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
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

  it('pages a room list, persists an edit, and removes a room', async () => {
    const created = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/rooms`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Page two', roomType: 'clone' })
      .expect(201);

    const page1 = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/room-pages?page=1&pageSize=1`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const page2 = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/room-pages?page=2&pageSize=1`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(page1.body.total).toBeGreaterThanOrEqual(2);
    expect(page1.body.items).toHaveLength(1);
    expect(page2.body.items).toHaveLength(1);
    expect(page1.body.items[0].id).not.toBe(page2.body.items[0].id);

    const edited = await request(app.getHttpServer())
      .patch(`/sites/${fixture.siteAId}/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Page two east', roomType: 'clone' })
      .expect(200);
    expect(edited.body.name).toBe('Page two east');
    const stored = await request(app.getHttpServer())
      .get(`/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(stored.body.name).toBe('Page two east');

    await request(app.getHttpServer())
      .delete(`/sites/${fixture.siteAId}/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/rooms/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
  });

  it('denies a site operator a change on the other facility', async () => {
    const denied = await request(app.getHttpServer())
      .patch(`/sites/${fixture.siteBId}/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Taken', roomType: 'veg' })
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this site');
    const still = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(still.body.name).toBe('Room B');
  });

  it('voids a plant and keeps the actor on the event', async () => {
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const license = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: `LIC-${Date.now()}`,
        licenseType: 'cultivation',
        jurisdiction: 'OR',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    const strain = await prisma.strain.create({
      data: { organizationId: fixture.organizationId, name: `Strain ${Date.now()}` },
    });
    const batch = await prisma.plantBatch.create({
      data: { licenseId: license.id, strainId: strain.id, name: 'Lot' },
    });
    const plant = await prisma.plant.create({
      data: {
        licenseId: license.id,
        batchId: batch.id,
        strainId: strain.id,
        tag: `TAG-${Date.now()}`,
        stage: 'veg',
      },
    });

    const removed = await request(app.getHttpServer())
      .delete(`/plants/${plant.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(removed.body.voided).toBe(true);

    const stored = await prisma.plant.findUniqueOrThrow({ where: { id: plant.id } });
    expect(stored.voidedAt).not.toBeNull();
    expect(stored.status).toBe('voided');
    const event = await prisma.plantEvent.findFirstOrThrow({
      where: { plantId: plant.id, eventType: 'voided' },
    });
    expect(event.actorUserId).toBe(actor.id);

    const list = await request(app.getHttpServer())
      .get(`/licenses/${license.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(list.body.plants.map((row: { id: string }) => row.id)).not.toContain(plant.id);
    expect(list.body.plantCount).toBe(0);

    const detail = await request(app.getHttpServer())
      .get(`/plants/${plant.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(detail.body.events.some((row: { eventType: string; actorName: string }) => row.eventType === 'voided' && row.actorName === actor.name)).toBe(true);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
