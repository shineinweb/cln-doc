import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('tasks.complete permission', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let operatorRoleId = '';
  let writePermId = '';
  let completePermId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run tasks.complete tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const operatorRole = await prisma.role.findFirstOrThrow({
      where: { organizationId: fixture.organizationId, key: 'site_operator' },
    });
    operatorRoleId = operatorRole.id;
    writePermId = (await prisma.permission.findFirstOrThrow({ where: { key: 'tasks.write' } })).id;
    completePermId = (await prisma.permission.findFirstOrThrow({ where: { key: 'tasks.complete' } })).id;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await restoreOperatorTaskPerms();
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('lets a role finish tasks with tasks.complete while blocking create/edit without tasks.write', async () => {
    await prisma.rolePermission.deleteMany({
      where: { roleId: operatorRoleId, permissionId: writePermId },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: operatorRoleId, permissionId: completePermId } },
      create: { roleId: operatorRoleId, permissionId: completePermId },
      update: {},
    });

    const token = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.permissions).toContain('tasks.complete');
    expect(me.body.permissions).not.toContain('tasks.write');

    const createDenied = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Should fail', kind: 'one_time', dueOn: '2026-10-10', weekdays: [], assigneeIds: [] });
    expect(createDenied.status).toBe(403);

    const task = await prisma.roomTask.create({
      data: {
        roomId: fixture.roomAId,
        title: 'Complete-only chore',
        kind: 'one_time',
        status: 'open',
        dueOn: new Date('2026-10-10T00:00:00.000Z'),
      },
    });

    const finished = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    expect(finished.body.id).toBe(task.id);
    expect(
      await prisma.roomTask.findUniqueOrThrow({ where: { id: task.id }, select: { status: true } }),
    ).toEqual({ status: 'done' });

    await prisma.roomTask.delete({ where: { id: task.id } });
    await restoreOperatorTaskPerms();
  });

  it('blocks finishing tasks when the role has neither tasks.complete nor tasks.write', async () => {
    await prisma.rolePermission.deleteMany({
      where: { roleId: operatorRoleId, permissionId: { in: [writePermId, completePermId] } },
    });
    const token = await login(fixture.siteAUser.email, fixture.siteAUser.password);

    const task = await prisma.roomTask.create({
      data: {
        roomId: fixture.roomAId,
        title: 'No-complete chore',
        kind: 'one_time',
        status: 'open',
        dueOn: new Date('2026-10-10T00:00:00.000Z'),
      },
    });

    const denied = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(denied.status).toBe(403);

    await prisma.roomTask.delete({ where: { id: task.id } });
    await restoreOperatorTaskPerms();
  });

  async function restoreOperatorTaskPerms() {
    for (const permissionId of [writePermId, completePermId]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: operatorRoleId, permissionId } },
        create: { roleId: operatorRoleId, permissionId },
        update: {},
      });
    }
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
