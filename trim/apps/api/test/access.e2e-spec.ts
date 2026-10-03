import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('user, role, and permission management', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run access tests against ${process.env.DATABASE_URL}`);
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

  it('lets a manager add, edit, and delete a user, role, and permission, and records the audit log', async () => {
    const stamp = Date.now().toString(16);
    const password = 'Access-user-1';
    const denied = await request(app.getHttpServer())
      .post('/access/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Denied', email: `denied-${stamp}@trim.test`, password, roleId: 'missing', siteIds: [] });
    expect(denied.status).toBe(403);
    expect(denied.body.message).toBe('Only a manager can change users, roles, and permissions.');

    const directory = await request(app.getHttpServer()).get('/access').set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
    const operator = directory.body.roles.find((role: { name: string }) => role.name === 'Site operator');
    expect(operator).toBeTruthy();

    const missingFacility = await request(app.getHttpServer())
      .post('/access/users')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'No Facility',
        email: `no-facility-${stamp}@trim.test`,
        password,
        roleId: operator.id,
        siteIds: [],
      });
    expect(missingFacility.status).toBe(400);
    expect(missingFacility.body.message).toBe('Choose a facility for this user.');

    const created = await request(app.getHttpServer())
      .post('/access/users')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'Dana Ruiz',
        email: `Dana-${stamp}@Trim.test`,
        password,
        roleId: operator.id,
        siteIds: [fixture.siteAId],
      });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Dana Ruiz');
    expect(created.body.email).toBe(`dana-${stamp}@trim.test`);
    expect(created.body.roleName).toBe('Site operator');
    expect(created.body.siteIds).toEqual([fixture.siteAId]);
    expect(JSON.stringify(created.body)).not.toContain(password);

    const stored = await prisma.credential.findUniqueOrThrow({ where: { userId: created.body.id } });
    expect(stored.passwordHash).not.toBe(password);

    const edited = await request(app.getHttpServer())
      .patch(`/access/users/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'Dana Ruiz East',
        email: created.body.email,
        password: '',
        roleId: operator.id,
        siteIds: [fixture.siteAId],
      })
      .expect(200);
    expect(edited.body.name).toBe('Dana Ruiz East');

    const self = directory.body.users.find((person: { email: string }) => person.email === fixture.adminUser.email);
    const selfDelete = await request(app.getHttpServer())
      .delete(`/access/users/${self.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(selfDelete.status).toBe(400);
    expect(selfDelete.body.message).toBe('You cannot delete your own account.');

    const removed = await request(app.getHttpServer())
      .delete(`/access/users/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(removed.body).toEqual({ id: created.body.id, removed: true, voided: false });
    expect(await prisma.user.findUnique({ where: { id: created.body.id } })).toBeNull();

    const permission = await request(app.getHttpServer())
      .post('/access/permissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ key: `notes.read.${stamp}`, description: 'Read notes' })
      .expect(201);
    expect(permission.body.key).toBe(`notes.read.${stamp}`);

    const role = await request(app.getHttpServer())
      .post('/access/roles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: `Floor lead ${stamp}`,
        description: 'Opens one facility.',
        opensEveryFacility: false,
        permissionIds: [permission.body.id],
      })
      .expect(201);
    expect(role.body.permissionKeys).toEqual([`notes.read.${stamp}`]);

    const roleEdited = await request(app.getHttpServer())
      .patch(`/access/roles/${role.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: role.body.name,
        description: 'Opens the assigned facility.',
        opensEveryFacility: false,
        permissionIds: [permission.body.id],
      })
      .expect(200);
    expect(roleEdited.body.description).toBe('Opens the assigned facility.');

    await request(app.getHttpServer())
      .delete(`/access/roles/${role.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const permissionEdited = await request(app.getHttpServer())
      .patch(`/access/permissions/${permission.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ key: permission.body.key, description: 'Read room notes' })
      .expect(200);
    expect(permissionEdited.body.description).toBe('Read room notes');
    await request(app.getHttpServer())
      .delete(`/access/permissions/${permission.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const after = await request(app.getHttpServer()).get('/access').set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
    const summaries = after.body.audit.map((entry: { summary: string }) => entry.summary);
    expect(summaries).toEqual(
      expect.arrayContaining([
        'Created user Dana Ruiz (dana-' + stamp + '@trim.test).',
        'Updated user Dana Ruiz East.',
        'Deleted user Dana Ruiz East.',
        `Created role Floor lead ${stamp}.`,
        `Created permission notes.read.${stamp}.`,
        'Org Admin signed in.',
      ]),
    );
    expect(JSON.stringify(after.body)).not.toContain(password);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
