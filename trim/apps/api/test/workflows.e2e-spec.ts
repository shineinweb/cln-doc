import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayInLosAngeles(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

describe('workflow engine', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let siteAUserId = '';
  let siteBUserId = '';
  let operatorRoleId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run workflow tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.site.update({ where: { id: fixture.siteAId }, data: { timezone: 'America/Los_Angeles' } });
    await prisma.site.update({ where: { id: fixture.siteBId }, data: { timezone: 'America/Los_Angeles' } });
    const users = await prisma.user.findMany({
      where: { email: { in: [fixture.siteAUser.email, fixture.siteBUser.email] } },
    });
    siteAUserId = users.find((user) => user.email === fixture.siteAUser.email)?.id ?? '';
    siteBUserId = users.find((user) => user.email === fixture.siteBUser.email)?.id ?? '';
    const role = await prisma.role.findFirstOrThrow({
      where: { organizationId: fixture.organizationId, key: 'site_operator' },
    });
    operatorRoleId = role.id;

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

  it('generates assignees and dates, keeps old versions, and previews a reschedule', async () => {
    await request(app.getHttpServer())
      .post('/workflows/templates')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Denied', durationDays: 7, startingEvent: 'cycle_start', tasks: [sampleTask('a')] })
      .expect(403);

    const sop = await request(app.getHttpServer())
      .post('/workflows/sops')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ title: `Scout ${Date.now()}`, summary: 'Walk the canopy.' })
      .expect(201);
    const team = await request(app.getHttpServer())
      .post('/workflows/teams')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ name: `Crew ${Date.now()}`, memberIds: [siteAUserId] })
      .expect(201);

    const created = await request(app.getHttpServer())
      .post('/workflows/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: `Canopy ${Date.now()}`,
        durationDays: 28,
        startingEvent: 'cycle_start',
        tasks: [
          {
            ...sampleTask('count'),
            title: 'Count plants',
            offsetDays: 0,
            assigneeType: 'employee',
            userId: siteAUserId,
          },
          {
            ...sampleTask('water'),
            title: 'Check irrigation',
            offsetDays: 1,
            assigneeType: 'team',
            teamId: team.body.id,
          },
          {
            ...sampleTask('scout'),
            title: 'Scout canopy',
            offsetDays: 2,
            assigneeType: 'role',
            roleId: operatorRoleId,
            sopRecordId: sop.body.id,
            dependsOnKey: 'count',
            requiresApproval: true,
          },
        ],
      })
      .expect(201);

    const versionId = created.body.currentVersion.id as string;
    const started = await request(app.getHttpServer())
      .post('/cycles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        roomId: fixture.roomAId,
        name: 'Workflow flower',
        cultivar: 'Workflow Cultivar',
        plantCount: 12,
        stage: 'flower',
        startDate: '2026-09-01',
        expectedHarvestDate: '2026-09-28',
        templateVersionId: versionId,
      })
      .expect(201);

    const tasks = await prisma.cycleTask.findMany({
      where: { cycleId: started.body.id },
      orderBy: { offsetDays: 'asc' },
    });
    expect(tasks.map((task) => dateKey(task.dueOn))).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(tasks[0]?.userId).toBe(siteAUserId);
    expect(tasks[1]?.teamId).toBe(team.body.id);
    expect(tasks[2]?.roleId).toBe(operatorRoleId);
    expect(tasks[2]?.dependsOnTaskId).toBe(tasks[0]?.id);
    expect(tasks[2]?.requiresApproval).toBe(true);
    expect(tasks.map((task) => task.title)).toEqual(['Count plants', 'Check irrigation', 'Scout canopy']);

    const edited = await request(app.getHttpServer())
      .post(`/workflows/templates/${created.body.id}/versions`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        durationDays: 28,
        startingEvent: 'cycle_start',
        tasks: [
          {
            ...sampleTask('revised'),
            title: 'Revised scout',
            offsetDays: 4,
            assigneeType: 'role',
            roleId: operatorRoleId,
          },
        ],
      })
      .expect(201);
    expect(edited.body.currentVersion.versionNumber).toBe(2);

    const unchanged = await prisma.cycleTask.findMany({ where: { cycleId: started.body.id }, orderBy: { offsetDays: 'asc' } });
    expect(unchanged.map((task) => task.title)).toEqual(['Count plants', 'Check irrigation', 'Scout canopy']);
    expect(unchanged.map((task) => dateKey(task.dueOn))).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);

    const applied = await request(app.getHttpServer())
      .post(`/cycles/${started.body.id}/workflow`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ versionId: edited.body.currentVersion.id })
      .expect(201);
    expect(applied.body.tasks.map((task: { title: string; dueOn: string }) => [task.title, task.dueOn])).toEqual([
      ['Revised scout', '2026-09-05'],
    ]);

    const beforePreview = await prisma.cropCycle.findUniqueOrThrow({ where: { id: started.body.id } });
    const beforeTasks = await prisma.cycleTask.findMany({ where: { cycleId: started.body.id } });
    const preview = await request(app.getHttpServer())
      .post(`/cycles/${started.body.id}/reschedule/preview`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ startDate: '2026-09-05' })
      .expect(201);
    expect(preview.body.persisted).toBe(false);
    expect(preview.body.tasks[0].toDueOn).toBe('2026-09-09');
    const afterPreview = await prisma.cropCycle.findUniqueOrThrow({ where: { id: started.body.id } });
    const afterTasks = await prisma.cycleTask.findMany({ where: { cycleId: started.body.id } });
    expect(dateKey(afterPreview.startDate)).toBe(dateKey(beforePreview.startDate));
    expect(afterTasks.map((task) => dateKey(task.dueOn))).toEqual(beforeTasks.map((task) => dateKey(task.dueOn)));

    const confirmed = await request(app.getHttpServer())
      .post(`/cycles/${started.body.id}/reschedule`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ startDate: '2026-09-05' })
      .expect(201);
    expect(confirmed.body.persisted).toBe(true);
    expect(confirmed.body.startDate).toBe('2026-09-05');
    expect(confirmed.body.tasks[0].dueOn).toBe('2026-09-09');
  });

  it('denies cross-site task, comment, and attachment access', async () => {
    const today = todayInLosAngeles();
    const template = await request(app.getHttpServer())
      .post('/workflows/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: `Site B only ${Date.now()}`,
        durationDays: 7,
        startingEvent: 'cycle_start',
        tasks: [
          {
            ...sampleTask('mine'),
            title: 'Hill bench check',
            offsetDays: 0,
            assigneeType: 'employee',
            userId: siteBUserId,
          },
        ],
      })
      .expect(201);
    const started = await request(app.getHttpServer())
      .post('/cycles')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        roomId: fixture.roomBId,
        name: 'Workflow veg',
        cultivar: 'Other',
        plantCount: 4,
        stage: 'veg',
        startDate: today,
        expectedHarvestDate: today,
        templateVersionId: template.body.currentVersion.id,
      })
      .expect(201);
    const taskId = started.body.tasks[0].id as string;

    await request(app.getHttpServer()).get(`/tasks/${taskId}`).set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer())
      .post(`/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Should not land' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', PNG, 'secret.png')
      .expect(403);

    const uploaded = await request(app.getHttpServer())
      .post(`/tasks/${taskId}/attachments`)
      .set('Authorization', `Bearer ${tokenB}`)
      .attach('file', PNG, 'bench.png')
      .expect(201);
    const attachmentId = uploaded.body.attachments[0].id as string;
    await request(app.getHttpServer())
      .get(`/tasks/${taskId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
    const downloaded = await request(app.getHttpServer())
      .get(`/tasks/${taskId}/attachments/${attachmentId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(downloaded.body.equals(PNG)).toBe(true);

    const workspace = await request(app.getHttpServer())
      .get('/workspace/today')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(workspace.body.tasks.some((task: { id: string }) => task.id === taskId)).toBe(false);
    const own = await request(app.getHttpServer())
      .get('/workspace/today')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(own.body.tasks.some((task: { id: string; siteName: string }) => task.id === taskId)).toBe(true);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});

function sampleTask(taskKey: string) {
  return {
    taskKey,
    title: taskKey,
    offsetDays: 0,
    assigneeType: 'role' as const,
    instructions: 'Follow the checklist.',
    checklist: ['Look', 'Record'],
    requiresNotes: true,
    requiresMeasurement: false,
    requiresPhoto: false,
    requiresSignOff: false,
    requiresApproval: false,
  };
}
