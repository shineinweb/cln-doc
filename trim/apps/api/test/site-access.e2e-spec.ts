import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('site access restrictions', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run access tests against ${process.env.DATABASE_URL}`);
    }

    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);

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

  it('rejects unauthenticated site and room reads', async () => {
    await request(app.getHttpServer()).get('/sites').expect(401);
    await request(app.getHttpServer()).get(`/sites/${fixture.siteAId}`).expect(401);
    await request(app.getHttpServer()).get(`/sites/${fixture.siteAId}/rooms`).expect(401);
    await request(app.getHttpServer()).get(`/rooms/${fixture.roomAId}`).expect(401);
  });

  it('lists only Site A for the Site A user', async () => {
    const response = await request(app.getHttpServer())
      .get('/sites')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.map((site: { id: string }) => site.id)).toEqual([fixture.siteAId]);
    expect(response.body[0].rooms.map((room: { id: string }) => room.id)).toEqual([fixture.roomAId]);
  });

  it('denies the Site A user every read of Site B', async () => {
    await request(app.getHttpServer())
      .get(`/sites/${fixture.siteBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/sites/${fixture.siteBId}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('still lets the Site A user read Site A', async () => {
    const response = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(response.body.id).toBe(fixture.siteAId);
    expect(response.body.rooms).toHaveLength(1);
  });

  it('lists only Site B for the Site B user', async () => {
    const response = await request(app.getHttpServer())
      .get('/sites')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(response.body.map((site: { id: string }) => site.id)).toEqual([fixture.siteBId]);
  });

  it('denies the Site B user every read of Site A', async () => {
    await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/rooms`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it('lets the organization admin read both sites and their rooms', async () => {
    const list = await request(app.getHttpServer())
      .get('/sites')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(new Set(list.body.map((site: { id: string }) => site.id))).toEqual(
      new Set([fixture.siteAId, fixture.siteBId]),
    );

    const siteA = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const siteB = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteBId}/rooms`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const roomA = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const roomB = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomBId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(siteA.body.code).toBe('SITE-A');
    expect(siteB.body.map((room: { id: string }) => room.id)).toEqual([fixture.roomBId]);
    expect(roomA.body.siteId).toBe(fixture.siteAId);
    expect(roomB.body.siteId).toBe(fixture.siteBId);
    expect(list.body.find((site: { id: string }) => site.id === fixture.siteBId)).toBeTruthy();
  });

  it('lets a user add a room only on a facility they can open', async () => {
    const denied = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteBId}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Site B clone room', roomType: 'clone' })
      .expect(403);
    expect(denied.body.message).toBe('You do not have access to this site');

    await request(app.getHttpServer())
      .post(`/sites/${fixture.otherSiteId}/rooms`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Other org room', roomType: 'dry' })
      .expect(404);

    const created = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteBId}/rooms`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: 'Site B clone room', roomType: 'clone' })
      .expect(201);
    expect(created.body.siteId).toBe(fixture.siteBId);
    expect(created.body.name).toBe('Site B clone room');
    expect(created.body.roomType).toBe('clone');
    expect(created.body.currentCycle).toBeNull();

    const rooms = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteBId}/rooms`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(rooms.body.map((room: { name: string }) => room.name)).toContain('Site B clone room');

    const own = await request(app.getHttpServer())
      .post(`/sites/${fixture.siteAId}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Site A dry room', roomType: 'dry' })
      .expect(201);
    expect(own.body.siteId).toBe(fixture.siteAId);
    expect(own.body.roomType).toBe('dry');
  });

  it('hides a site that belongs to another organization', async () => {
    await request(app.getHttpServer())
      .get(`/sites/${fixture.otherSiteId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/sites/${fixture.otherSiteId}/rooms`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/rooms/${fixture.otherRoomId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    const adminList = await request(app.getHttpServer())
      .get('/sites')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(adminList.body.map((site: { id: string }) => site.id)).not.toContain(fixture.otherSiteId);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    expect(typeof response.body.accessToken).toBe('string');
    return response.body.accessToken as string;
  }
});
