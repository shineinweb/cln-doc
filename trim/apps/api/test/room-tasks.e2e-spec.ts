import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('room tasks', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let siteAUserId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run room task tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const siteAUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    siteAUserId = siteAUser.id;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
    tokenAdmin = await login(fixture.adminUser.email, fixture.adminUser.password);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('adds, edits, and deletes a one-time or recurring room task and can assign an employee', async () => {
    const denied = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Denied', kind: 'one_time', dueOn: '2026-10-03', assigneeId: null });
    expect(denied.status).toBe(403);

    const missingCadence = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Scout', kind: 'recurring', dueOn: '2026-10-03', assigneeId: null });
    expect(missingCadence.status).toBe(400);
    expect(missingCadence.body.message).toBe('Choose daily or weekly for a recurring task.');

    const missingDays = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Scout', kind: 'recurring', cadence: 'weekly', dueOn: '2026-10-06', assigneeId: null });
    expect(missingDays.status).toBe(400);
    expect(missingDays.body.message).toBe('Choose at least one day of the week.');

    const wrongDay = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Scout',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['tue', 'fri'],
        dueOn: '2026-10-07',
        assigneeId: null,
      });
    expect(wrongDay.status).toBe(400);
    expect(wrongDay.body.message).toBe('Next due must be one of the selected days.');

    const siteBUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteBUser.email } });
    const wrongPerson = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Wrong person', kind: 'one_time', dueOn: '2026-10-03', assigneeId: siteBUser.id });
    expect(wrongPerson.status).toBe(400);
    expect(wrongPerson.body.message).toBe('That person cannot open this facility.');

    const created = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Check the drain',
        description: '  Look under the bench.  ',
        kind: 'one_time',
        dueOn: '2026-10-03',
        assigneeId: null,
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Check the drain',
      description: 'Look under the bench.',
      kind: 'one_time',
      cadence: null,
      weekdays: [],
      dueOn: '2026-10-03',
      assigneeId: null,
      assigneeName: null,
    });

    const recurring = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Scout the canopy',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['sat'],
        dueOn: '2026-10-10',
        assigneeId: siteAUserId,
      });
    expect(recurring.status).toBe(201);
    expect(recurring.body.kind).toBe('recurring');
    expect(recurring.body.cadence).toBe('weekly');
    expect(recurring.body.weekdays).toEqual(['sat']);
    expect(recurring.body.assigneeId).toBe(siteAUserId);
    expect(recurring.body.assigneeName).toBe('Site A Operator');

    const onDays = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Defoliate',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['fri', 'tue', 'tue'],
        dueOn: '2026-10-06',
        assigneeId: null,
      });
    expect(onDays.status).toBe(201);
    expect(onDays.body.weekdays).toEqual(['tue', 'fri']);
    expect(onDays.body.dueOn).toBe('2026-10-06');

    const edited = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Check the east drain',
        kind: 'recurring',
        cadence: 'daily',
        dueOn: '2026-10-04',
        assigneeId: siteAUserId,
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      title: 'Check the east drain',
      kind: 'recurring',
      cadence: 'daily',
      weekdays: [],
      assigneeName: 'Site A Operator',
    });

    const cleared = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Check the east drain',
        kind: 'one_time',
        dueOn: '2026-10-04',
        assigneeId: null,
      })
      .expect(200);
    expect(cleared.body.assigneeId).toBeNull();
    expect(cleared.body.kind).toBe('one_time');
    expect(cleared.body.description).toBeNull();

    const room = await request(app.getHttpServer())
      .get(`/rooms/${fixture.roomAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(room.body.managedTasks.map((task: { title: string }) => task.title).sort()).toEqual([
      'Check the east drain',
      'Defoliate',
      'Scout the canopy',
    ]);
    const listed = room.body.managedTasks.find((task: { title: string }) => task.title === 'Defoliate');
    expect(listed.weekdays).toEqual(['tue', 'fri']);

    const fridayOnly = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${onDays.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Defoliate',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['fri'],
        dueOn: '2026-10-09',
        assigneeId: null,
      })
      .expect(200);
    expect(fridayOnly.body.weekdays).toEqual(['fri']);

    await request(app.getHttpServer())
      .delete(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/rooms/${fixture.roomAId}/tasks/${recurring.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/rooms/${fixture.roomAId}/tasks/${onDays.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(await prisma.roomTask.count({ where: { roomId: fixture.roomAId } })).toBe(0);
  });

  it('assigns an employee on a crop task without clearing a role assignment when the employee is omitted', async () => {
    const cycle = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Task cycle',
        cultivar: 'Test',
        plantCount: 1,
        stage: 'flower',
        startDate: new Date('2026-10-03T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-10-24T00:00:00.000Z'),
        status: 'active',
      },
    });
    const task = await prisma.cycleTask.create({
      data: {
        cycleId: cycle.id,
        roomId: fixture.roomAId,
        taskKey: 'count',
        title: 'Count plants',
        instructions: 'Count',
        offsetDays: 0,
        dueOn: new Date('2026-10-03T00:00:00.000Z'),
        assigneeType: 'role',
        assigneeLabel: 'Site operator',
      },
    });

    const unchanged = await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Count plants onto the bench', dueOn: '2026-10-03' })
      .expect(200);
    expect(unchanged.body.removed).toBe(false);
    const kept = await prisma.cycleTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(kept.assigneeLabel).toBe('Site operator');
    expect(kept.userId).toBeNull();

    await request(app.getHttpServer())
      .patch(`/tasks/${task.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Count plants onto the bench', dueOn: '2026-10-03', assigneeId: siteAUserId })
      .expect(200);
    const assigned = await prisma.cycleTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(assigned.assigneeLabel).toBe('Site A Operator');
    expect(assigned.userId).toBe(siteAUserId);

    await prisma.cropCycle.delete({ where: { id: cycle.id } });
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
