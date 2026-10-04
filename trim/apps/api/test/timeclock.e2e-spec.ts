import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('time clock and AI payroll', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run timeclock tests against ${process.env.DATABASE_URL}`);
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
    await prisma.timePunch.deleteMany({
      where: { organizationId: { in: [fixture.organizationId, fixture.otherOrganizationId] } },
    });
    await prisma.laborRate.deleteMany({ where: { organizationId: fixture.organizationId } });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('punches clock in, lunch, and clock out, then builds AI payroll', async () => {
    const deniedLunch = await request(app.getHttpServer())
      .post('/timeclock/punch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'lunch_start', siteId: fixture.siteAId });
    expect(deniedLunch.status).toBe(400);

    const clockIn = await request(app.getHttpServer())
      .post('/timeclock/punch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'clock_in', siteId: fixture.siteAId })
      .expect(200);
    expect(clockIn.body.state).toBe('in');
    expect(clockIn.body.allowed).toEqual(expect.arrayContaining(['lunch_start', 'clock_out']));

    // Backdate punches so payroll has measurable hours.
    const siteAUser = await prisma.user.findUniqueOrThrow({ where: { email: fixture.siteAUser.email } });
    const punches = await prisma.timePunch.findMany({ where: { userId: siteAUser.id }, orderBy: { punchedAt: 'asc' } });
    expect(punches).toHaveLength(1);
    const day = '2026-10-03';
    await prisma.timePunch.update({
      where: { id: punches[0].id },
      data: { punchedAt: new Date(`${day}T15:00:00.000Z`) },
    });
    // 15:00–19:00 work, 19:00–19:30 lunch, 19:30–23:30 work → 8h worked, 0.5h lunch
    await prisma.timePunch.createMany({
      data: [
        {
          organizationId: fixture.organizationId,
          siteId: fixture.siteAId,
          userId: siteAUser.id,
          kind: 'lunch_start',
          punchedAt: new Date(`${day}T19:00:00.000Z`),
        },
        {
          organizationId: fixture.organizationId,
          siteId: fixture.siteAId,
          userId: siteAUser.id,
          kind: 'lunch_end',
          punchedAt: new Date(`${day}T19:30:00.000Z`),
        },
        {
          organizationId: fixture.organizationId,
          siteId: fixture.siteAId,
          userId: siteAUser.id,
          kind: 'clock_out',
          punchedAt: new Date(`${day}T23:30:00.000Z`),
        },
      ],
    });

    await request(app.getHttpServer())
      .post('/timeclock/rates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ personName: siteAUser.name, hourlyCents: 2800 })
      .expect(200);

    const operatorDenied = await request(app.getHttpServer())
      .get(`/timeclock/payroll?from=${day}&to=${day}&siteId=${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(operatorDenied.status).toBe(403);

    const payroll = await request(app.getHttpServer())
      .get(`/timeclock/payroll?from=${day}&to=${day}&siteId=${fixture.siteAId}`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    expect(payroll.body.statement).toContain('AI payroll');
    expect(payroll.body.totals.employees).toBe(1);
    expect(payroll.body.employees[0].userName).toBe(siteAUser.name);
    // 4h before lunch + 4h after lunch = 8h worked, 0.5h lunch
    expect(payroll.body.employees[0].workedMinutes).toBe(480);
    expect(payroll.body.employees[0].lunchMinutes).toBe(30);
    expect(payroll.body.employees[0].regularMinutes).toBe(480);
    expect(payroll.body.employees[0].overtimeMinutes).toBe(0);
    expect(payroll.body.employees[0].grossCents).toBe(22400);

    const ask = await request(app.getHttpServer())
      .post('/timeclock/payroll/ask')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ question: 'What is the total gross pay?', periodStart: day, periodEnd: day, siteId: fixture.siteAId })
      .expect(200);
    expect(ask.body.reply).toEqual(expect.stringMatching(/I'm Serenity[\s\S]*\$224\.00/));
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
