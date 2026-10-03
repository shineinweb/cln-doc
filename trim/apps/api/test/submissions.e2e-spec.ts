import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SubmissionsService } from '../src/submissions/submissions.service';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('reviewed metrc submissions', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let submissions: SubmissionsService;
  let tokenA = '';
  let tokenAdmin = '';
  let licenseBId = '';
  let moveEventId = '';
  let failEventId = '';
  let uncertainEventId = '';
  let landedEventId = '';
  let rejectEventId = '';
  const secret = 'secret-metrc-submission-key';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run submission tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    const licenseA = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'SUB-A',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteAId } },
      },
    });
    const licenseB = await prisma.license.create({
      data: {
        organizationId: fixture.organizationId,
        licenseNumber: 'SUB-B',
        licenseType: 'producer',
        jurisdiction: 'US-OR',
        sites: { create: { siteId: fixture.siteBId } },
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
      data: { organizationId: fixture.organizationId, name: 'Submission strain' },
    });
    const batchA = await prisma.plantBatch.create({
      data: { licenseId: licenseA.id, strainId: strain.id, name: 'Batch A' },
    });
    const batchB = await prisma.plantBatch.create({
      data: { licenseId: licenseB.id, strainId: strain.id, name: 'Batch B' },
    });
    const plantA = await prisma.plant.create({
      data: {
        licenseId: licenseA.id,
        batchId: batchA.id,
        strainId: strain.id,
        roomId: fixture.roomAId,
        tag: 'SUB-A-1',
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
        tag: 'SUB-B-1',
        stage: 'veg',
        status: 'active',
      },
    });
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    moveEventId = await event(plantA.id, licenseA.id, actor.id, 'moved');
    failEventId = await event(plantA.id, licenseA.id, actor.id, 'stage_changed');
    uncertainEventId = await event(plantA.id, licenseA.id, actor.id, 'stage_changed');
    landedEventId = await event(plantA.id, licenseA.id, actor.id, 'moved');
    rejectEventId = await event(plantA.id, licenseA.id, actor.id, 'moved');
    const hidden = await prisma.plantEvent.create({
      data: {
        plantId: plantB.id,
        licenseId: licenseB.id,
        eventType: 'moved',
        actorUserId: actor.id,
        occurredAt: new Date(),
        note: 'Hill event',
      },
    });
    const hiddenSubmission = await prisma.metrcSubmission.create({
      data: {
        licenseId: licenseB.id,
        plantEventId: hidden.id,
        status: 'pending_review',
        sandboxOutcome: 'success',
        requestedById: actor.id,
        requestedAt: new Date(),
      },
    });
    licenseBId = licenseB.id;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    submissions = app.get(SubmissionsService);
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenAdmin = await login(fixture.adminUser.email, fixture.adminUser.password);
    await request(app.getHttpServer())
      .get(`/submissions/${hiddenSubmission.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
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

  it('does not deliver a submission until a manager approves it', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Metrc must not be called'));
    const queued = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ plantEventId: moveEventId, sandboxOutcome: 'success' })
      .expect(201);
    expect(queued.body.status).toBe('pending_review');
    expect(queued.body.attempt).toBeNull();
    await submissions.deliverPending();
    expect(await prisma.metrcOutbox.count({ where: { submissionId: queued.body.id } })).toBe(0);
    expect(await prisma.metrcAttempt.count({ where: { submissionId: queued.body.id } })).toBe(0);

    await request(app.getHttpServer())
      .post(`/submissions/${queued.body.id}/review`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ decision: 'approve', sandboxOutcome: 'success' })
      .expect(403);

    const approved = await request(app.getHttpServer())
      .post(`/submissions/${queued.body.id}/review`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ decision: 'approve', sandboxOutcome: 'success' })
      .expect(201);
    expect(approved.body.status).toBe('queued');
    const outbox = await prisma.metrcOutbox.findMany({ where: { submissionId: queued.body.id } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.status).toBe('pending');
    expect(await prisma.metrcAttempt.count({ where: { submissionId: queued.body.id } })).toBe(0);

    await submissions.deliverPending();
    const stored = await prisma.metrcSubmission.findUniqueOrThrow({ where: { id: queued.body.id } });
    const attempt = await prisma.metrcAttempt.findFirstOrThrow({ where: { submissionId: queued.body.id } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: fixture.adminUser.email } });
    expect(stored.status).toBe('succeeded');
    expect(attempt.outcome).toBe('success');
    expect(attempt.actorUserId).toBe(admin.id);
    expect(attempt.requestId).toBe(outbox[0]?.requestId);
    expect(attempt.occurredAt).toBeInstanceOf(Date);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();

    const again = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId: moveEventId, sandboxOutcome: 'success' })
      .expect(400);
    expect(again.body.message).toContain('already landed');
  });

  it('stores a definite failure and allows a new unsent submission', async () => {
    const id = await approveAndDeliver(failEventId, 'failure');
    const stored = await prisma.metrcSubmission.findUniqueOrThrow({
      where: { id },
      include: { attempts: true },
    });
    expect(stored.status).toBe('failed');
    expect(stored.attempts).toHaveLength(1);
    expect(stored.attempts[0]?.outcome).toBe('failure');

    const retry = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId: failEventId, sandboxOutcome: 'success' })
      .expect(201);
    expect(retry.body.status).toBe('pending_review');
    await submissions.deliverPending();
    expect(await prisma.metrcOutbox.count({ where: { submissionId: retry.body.id } })).toBe(0);
    expect(await prisma.metrcSubmission.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'failed' });
  });

  it('blocks an uncertain change until reconciliation, which can land or miss', async () => {
    const uncertainId = await approveAndDeliver(uncertainEventId, 'uncertain');
    const uncertain = await prisma.metrcSubmission.findUniqueOrThrow({
      where: { id: uncertainId },
      include: { attempts: true },
    });
    expect(uncertain.status).toBe('uncertain');
    expect(uncertain.attempts[0]?.outcome).toBe('uncertain');
    expect(uncertain.attempts[0]?.reconciliationResult).toBeNull();

    const blocked = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId: uncertainEventId, sandboxOutcome: 'success' })
      .expect(400);
    expect(blocked.body.message).toContain('until reconciliation');

    const missed = await request(app.getHttpServer())
      .post(`/submissions/${uncertainId}/reconcile`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ finding: 'not_landed' })
      .expect(201);
    expect(missed.body.status).toBe('reconciled');
    expect(missed.body.attempt.reconciliationResult).toBe('not_landed');
    expect(missed.body.attempt.reconciledByName).toBe('Org Admin');
    const opened = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId: uncertainEventId, sandboxOutcome: 'success' })
      .expect(201);
    expect(opened.body.status).toBe('pending_review');
    expect(await prisma.metrcOutbox.count({ where: { submissionId: opened.body.id } })).toBe(0);

    const landedId = await approveAndDeliver(landedEventId, 'uncertain');
    const landed = await request(app.getHttpServer())
      .post(`/submissions/${landedId}/reconcile`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ finding: 'landed' })
      .expect(201);
    expect(landed.body.attempt.reconciliationResult).toBe('landed');
    await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId: landedEventId, sandboxOutcome: 'success' })
      .expect(400);
  });

  it('records the reviewer on rejection and does not write an outbox row', async () => {
    const queued = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ plantEventId: rejectEventId, sandboxOutcome: 'success' })
      .expect(201);
    const rejected = await request(app.getHttpServer())
      .post(`/submissions/${queued.body.id}/review`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ decision: 'reject', note: 'Hold this move.' })
      .expect(201);
    expect(rejected.body.status).toBe('rejected');
    expect(rejected.body.reviewerName).toBe('Org Admin');
    expect(await prisma.metrcOutbox.count({ where: { submissionId: queued.body.id } })).toBe(0);
    await submissions.deliverPending();
    expect(await prisma.metrcAttempt.count({ where: { submissionId: queued.body.id } })).toBe(0);
  });

  it('hides another license’s submissions', async () => {
    const overview = await request(app.getHttpServer())
      .get('/compliance')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(overview.body.licenses.map((license: { licenseNumber: string }) => license.licenseNumber)).toEqual(['SUB-A']);
    expect(JSON.stringify(overview.body)).not.toContain(secret);
    expect(JSON.stringify(overview.body)).not.toContain('SUB-B');
    const foreign = await prisma.metrcSubmission.findFirstOrThrow({ where: { licenseId: licenseBId } });
    await request(app.getHttpServer())
      .post(`/submissions/${foreign.id}/review`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ decision: 'approve', sandboxOutcome: 'success' })
      .expect(403);
    const own = await request(app.getHttpServer())
      .get('/compliance')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    const licenseB = own.body.licenses.find((license: { id: string }) => license.id === licenseBId);
    expect(licenseB.submissions).toHaveLength(1);
  });

  async function approveAndDeliver(plantEventId: string, sandboxOutcome: string): Promise<string> {
    const queued = await request(app.getHttpServer())
      .post('/submissions')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ plantEventId, sandboxOutcome })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/submissions/${queued.body.id}/review`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ decision: 'approve', sandboxOutcome })
      .expect(201);
    const outbox = await prisma.metrcOutbox.count({ where: { submissionId: queued.body.id } });
    expect(outbox).toBe(1);
    await submissions.deliverPending();
    return queued.body.id as string;
  }

  async function event(plantId: string, licenseId: string, actorUserId: string, eventType: string): Promise<string> {
    const created = await prisma.plantEvent.create({
      data: {
        plantId,
        licenseId,
        eventType,
        actorUserId,
        occurredAt: new Date(),
        note: eventType,
      },
    });
    return created.id;
  }

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
