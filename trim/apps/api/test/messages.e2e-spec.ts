import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('internal messages and AI chatbot', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';
  let tokenAdmin = '';
  let siteAUserId = '';
  let siteBUserId = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run messages tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.sopRecord.create({
      data: {
        organizationId: fixture.organizationId,
        title: 'Temperature check',
        summary: 'Walk the room and record the temperature.',
      },
    });
    const siteAUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const siteBUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteBUser.email } });
    siteAUserId = siteAUser.id;
    siteBUserId = siteBUser.id;

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

  it('lists organization people, opens a direct thread, and delivers a message both ways', async () => {
    const directory = await request(app.getHttpServer())
      .get('/messages/directory')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const peerIds = directory.body.people.map((person: { id: string }) => person.id);
    expect(peerIds).toContain(siteBUserId);
    expect(peerIds).not.toContain(siteAUserId);

    const opened = await request(app.getHttpServer())
      .post('/messages/threads/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ peerUserId: siteBUserId })
      .expect(201);
    expect(opened.body.kind).toBe('direct');
    expect(opened.body.peerUserId).toBe(siteBUserId);
    expect(opened.body.title).toBe('Site B Operator');
    expect(opened.body.messages.some((row: { kind: string }) => row.kind === 'system')).toBe(true);

    const sent = await request(app.getHttpServer())
      .post(`/messages/threads/${opened.body.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'Can you check Flower A?' })
      .expect(201);
    expect(sent.body.messages.some((row: { body: string; kind: string }) => row.body === 'Can you check Flower A?' && row.kind === 'user')).toBe(
      true,
    );

    const forB = await request(app.getHttpServer())
      .get('/messages/threads')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(forB.body.threads.some((thread: { id: string }) => thread.id === opened.body.id)).toBe(true);

    const reply = await request(app.getHttpServer())
      .post(`/messages/threads/${opened.body.id}/messages`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ body: 'On my way.' })
      .expect(201);
    expect(reply.body.messages.at(-1)).toMatchObject({
      body: 'On my way.',
      authorName: 'Site B Operator',
      kind: 'user',
    });

    const again = await request(app.getHttpServer())
      .post('/messages/threads/direct')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ peerUserId: siteBUserId })
      .expect(201);
    expect(again.body.id).toBe(opened.body.id);
  });

  it('opens a persisted AI thread and replies with the facility coach', async () => {
    const opened = await request(app.getHttpServer())
      .post('/messages/threads/ai')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ siteId: fixture.siteAId })
      .expect(201);
    expect(opened.body.kind).toBe('ai');
    expect(opened.body.title).toBe('Serenity');
    expect(opened.body.messages[0]?.kind).toBe('assistant');
    expect(opened.body.messages[0]?.authorName).toBe('Serenity');
    expect(opened.body.messages[0]?.body).toEqual(expect.stringMatching(/I'm Serenity/i));

    const answered = await request(app.getHttpServer())
      .post(`/messages/threads/${opened.body.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ body: 'How do I check temperature?' })
      .expect(201);
    const assistant = [...answered.body.messages].reverse().find((row: { kind: string }) => row.kind === 'assistant');
    expect(assistant?.authorName).toBe('Serenity');
    expect(assistant?.body).toEqual(expect.stringMatching(/I'm Serenity/i));
    expect(assistant?.body).toEqual(expect.stringMatching(/Temperature check|stored procedure|procedure/i));

    const listed = await request(app.getHttpServer())
      .get('/messages/threads')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(listed.body.threads.some((thread: { id: string; kind: string }) => thread.id === opened.body.id && thread.kind === 'ai')).toBe(
      true,
    );

    const again = await request(app.getHttpServer())
      .post('/messages/threads/ai')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ siteId: fixture.siteAId })
      .expect(201);
    expect(again.body.id).toBe(opened.body.id);
    expect(again.body.messages.length).toBeGreaterThanOrEqual(answered.body.messages.length);
  });

  it('keeps another organization out of the directory and threads', async () => {
    const otherUser = await prisma.user.create({
      data: {
        organizationId: fixture.otherOrganizationId,
        email: `other-${Date.now()}@trim.test`,
        name: 'Other Org Person',
      },
      select: { id: true },
    });
    const directory = await request(app.getHttpServer())
      .get('/messages/directory')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);
    expect(directory.body.people.some((person: { id: string }) => person.id === otherUser.id)).toBe(false);

    const denied = await request(app.getHttpServer())
      .post('/messages/threads/direct')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ peerUserId: otherUser.id });
    expect(denied.status).toBe(404);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
