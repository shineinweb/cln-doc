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
      .send({ title: 'Denied', kind: 'one_time', dueOn: '2026-10-03', assigneeIds: [] });
    expect(denied.status).toBe(403);

    const missingCadence = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Scout', kind: 'recurring', dueOn: '2026-10-03', assigneeIds: [] });
    expect(missingCadence.status).toBe(400);
    expect(missingCadence.body.message).toBe('Choose daily or weekly for a recurring task.');

    const missingDays = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Scout', kind: 'recurring', cadence: 'weekly', assigneeIds: [] });
    expect(missingDays.status).toBe(400);
    expect(missingDays.body.message).toBe('Choose at least one day of the week.');

    const missingDue = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Scout', kind: 'one_time', assigneeIds: [] });
    expect(missingDue.status).toBe(400);
    expect(missingDue.body.message).toBe('Enter a due date.');

    const siteBUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteBUser.email } });
    const wrongPerson = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: 'Wrong person', kind: 'one_time', dueOn: '2026-10-03', assigneeIds: [siteBUser.id] });
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
        assigneeIds: [],
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Check the drain',
      description: 'Look under the bench.',
      kind: 'one_time',
      cadence: null,
      weekdays: [],
      dueOn: '2026-10-03',
      assignees: [],
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
        assigneeIds: [siteAUserId],
      });
    expect(recurring.status).toBe(201);
    expect(recurring.body.kind).toBe('recurring');
    expect(recurring.body.cadence).toBe('weekly');
    expect(recurring.body.weekdays).toEqual(['sat']);
    expect(recurring.body.dueOn).toBeNull();
    expect(recurring.body.assignees).toEqual([{ id: siteAUserId, name: 'Site A Operator' }]);

    const onDays = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Defoliate',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['fri', 'tue', 'tue'],
        assigneeIds: [],
      });
    expect(onDays.status).toBe(201);
    expect(onDays.body.weekdays).toEqual(['tue', 'fri']);
    expect(onDays.body.dueOn).toBeNull();

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixture.adminUser.email } });
    const shared = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${onDays.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Defoliate',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: ['tue', 'fri'],
        assigneeIds: [siteAUserId, admin.id, siteAUserId],
      })
      .expect(200);
    expect(shared.body.assignees).toEqual([
      { id: admin.id, name: 'Org Admin' },
      { id: siteAUserId, name: 'Site A Operator' },
    ]);

    const edited = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Check the east drain',
        kind: 'recurring',
        cadence: 'daily',
        assigneeIds: [siteAUserId],
      })
      .expect(200);
    expect(edited.body).toMatchObject({
      title: 'Check the east drain',
      kind: 'recurring',
      cadence: 'daily',
      weekdays: [],
      dueOn: null,
      assignees: [{ id: siteAUserId, name: 'Site A Operator' }],
    });

    const cleared = await request(app.getHttpServer())
      .patch(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        title: 'Check the east drain',
        kind: 'one_time',
        dueOn: '2026-10-04',
        assigneeIds: [],
      })
      .expect(200);
    expect(cleared.body.assignees).toEqual([]);
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
        assigneeIds: [siteAUserId, admin.id],
      })
      .expect(200);
    expect(fridayOnly.body.weekdays).toEqual(['fri']);
    expect(fridayOnly.body.assignees.map((person: { name: string }) => person.name)).toEqual(['Org Admin', 'Site A Operator']);

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

  it('lists room chores on the unified Tasks workspace with crop-cycle work', async () => {
    const site = await prisma.site.findUniqueOrThrow({ where: { id: fixture.siteAId } });
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: site.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const created = await request(app.getHttpServer())
      .post(`/rooms/${fixture.roomAId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Unified workspace chore',
        description: 'Shows on Tasks',
        kind: 'one_time',
        dueOn: todayKey,
        assigneeIds: [siteAUserId],
      })
      .expect(201);

    const cycle = await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Unified cycle',
        cultivar: 'Test',
        plantCount: 1,
        stage: 'flower',
        startDate: new Date(`${todayKey}T00:00:00.000Z`),
        expectedHarvestDate: new Date(`${todayKey}T00:00:00.000Z`),
        status: 'active',
      },
    });
    const cycleTask = await prisma.cycleTask.create({
      data: {
        cycleId: cycle.id,
        roomId: fixture.roomAId,
        taskKey: 'unified',
        title: 'Unified cycle task',
        instructions: 'Count',
        offsetDays: 0,
        dueOn: new Date(`${todayKey}T00:00:00.000Z`),
        assigneeType: 'employee',
        assigneeLabel: 'Site A Operator',
        userId: siteAUserId,
      },
    });
    await prisma.recurringDuty.create({
      data: {
        siteId: fixture.siteAId,
        roomId: fixture.roomAId,
        title: 'Unified duty',
        cadence: 'daily',
        nextDueOn: new Date(`${todayKey}T00:00:00.000Z`),
        assigneeLabel: 'Site A Operator',
      },
    });

    const workspace = await request(app.getHttpServer())
      .get('/workspace/today')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(workspace.body.statement).toContain('crop cycles');
    expect(workspace.body.tasks.some((task: { id: string }) => task.id === cycleTask.id)).toBe(true);
    expect(workspace.body.roomTasks.some((task: { id: string; title: string }) => task.id === created.body.id && task.title === 'Unified workspace chore')).toBe(
      true,
    );
    expect(workspace.body.duties.some((duty: { title: string }) => duty.title === 'Unified duty')).toBe(true);

    await request(app.getHttpServer())
      .delete(`/rooms/${fixture.roomAId}/tasks/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await prisma.cropCycle.delete({ where: { id: cycle.id } });
    await prisma.recurringDuty.deleteMany({ where: { siteId: fixture.siteAId, title: 'Unified duty' } });
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
