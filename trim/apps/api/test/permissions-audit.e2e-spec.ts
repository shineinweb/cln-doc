import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OPERATOR_PERMISSION_KEYS } from '../src/auth/permissions';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('module permissions and audit logging', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenAdmin = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run permissions tests against ${process.env.DATABASE_URL}`);
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

  it('returns role permissions on /auth/me and blocks modules the operator cannot open', async () => {
    const me = await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(me.body.isOrgAdmin).toBe(false);
    expect(me.body.permissions).toEqual(expect.arrayContaining([...OPERATOR_PERMISSION_KEYS]));
    expect(me.body.permissions).not.toContain('access.manage');
    expect(me.body.permissions).not.toContain('settings.manage');
    expect(me.body.permissions).not.toContain('timeclock.manage');

    await request(app.getHttpServer()).get('/access').set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer()).get('/settings').set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer()).get('/timeclock/payroll?from=2026-01-01&to=2026-01-07').set('Authorization', `Bearer ${tokenA}`).expect(403);
    await request(app.getHttpServer()).get('/sites').set('Authorization', `Bearer ${tokenA}`).expect(200);
    await request(app.getHttpServer()).get('/organization').set('Authorization', `Bearer ${tokenA}`).expect(200);
  });

  it('logs signed-in module actions into the audit log', async () => {
    await request(app.getHttpServer()).get('/organization').set('Authorization', `Bearer ${tokenAdmin}`).expect(200);
    await request(app.getHttpServer())
      .post('/timeclock/punch')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ kind: 'clock_in', siteId: fixture.siteAId })
      .expect(200);

    const audit = await prisma.auditLog.findMany({
      where: { organizationId: fixture.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const summaries = audit.map((entry) => entry.summary);
    expect(summaries).toEqual(expect.arrayContaining([expect.stringContaining('GET /organization')]));
    expect(summaries).toEqual(expect.arrayContaining([expect.stringContaining('POST /timeclock/punch')]));
    expect(summaries).toEqual(expect.arrayContaining([expect.stringMatching(/signed in/i)]));
  });

  it('blocks previously ungated void/create routes without write permissions and audits the denial', async () => {
    // Strip harvests.write / inventory.write from the operator for this check.
    const harvestPerm = await prisma.permission.findFirst({ where: { key: 'harvests.write' } });
    const inventoryPerm = await prisma.permission.findFirst({ where: { key: 'inventory.write' } });
    expect(harvestPerm).toBeTruthy();
    expect(inventoryPerm).toBeTruthy();
    const operatorRole = await prisma.role.findFirst({
      where: { organizationId: fixture.organizationId, key: 'site_operator' },
    });
    expect(operatorRole).toBeTruthy();
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: operatorRole!.id,
        permissionId: { in: [harvestPerm!.id, inventoryPerm!.id] },
      },
    });
    const restrictedToken = await login(fixture.siteAUser.email, fixture.siteAUser.password);

    await request(app.getHttpServer())
      .delete('/harvests/permission-probe-harvest-id')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/licenses/permission-probe-license-id/plants')
      .set('Authorization', `Bearer ${restrictedToken}`)
      .send({ batchId: 'permission-probe-batch-id', tag: 'TEMP-TAG', stage: 'veg' })
      .expect(403);

    const denied = await prisma.auditLog.findMany({
      where: {
        organizationId: fixture.organizationId,
        summary: { contains: '→ 403' },
      },
      take: 10,
    });
    expect(denied.length).toBeGreaterThan(0);

    // Restore operator write grants for later suites sharing the DB.
    for (const permissionId of [harvestPerm!.id, inventoryPerm!.id]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: operatorRole!.id, permissionId } },
        create: { roleId: operatorRole!.id, permissionId },
        update: {},
      });
    }
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    expect(Array.isArray(response.body.user.permissions)).toBe(true);
    return response.body.accessToken as string;
  }
});
