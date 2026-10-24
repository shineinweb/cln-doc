import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@trim/database';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAccessFixture, type AccessFixture } from './fixture';

const TEST_DATABASE_URL = 'mysql://trim:trim@127.0.0.1:3306/trim_test';

describe('facility board', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let fixture: AccessFixture;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('/trim_test')) {
      throw new Error(`Refusing to run facility board tests against ${process.env.DATABASE_URL}`);
    }
    prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    fixture = await createAccessFixture(prisma);
    await prisma.cropCycle.create({
      data: {
        roomId: fixture.roomAId,
        name: 'Board crop',
        cultivar: 'Board Strain',
        plantCount: 40,
        stage: 'flower',
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        expectedHarvestDate: new Date('2026-12-01T00:00:00.000Z'),
        status: 'active',
      },
    });
    await prisma.roomDefoliation.createMany({
      data: [
        { roomId: fixture.roomAId, dayNumber: 10 },
        { roomId: fixture.roomAId, dayNumber: 21 },
        { roomId: fixture.roomAId, dayNumber: 35 },
      ],
    });
    await prisma.roomTransplant.createMany({
      data: [
        { roomId: fixture.roomAId, dayNumber: 7 },
        { roomId: fixture.roomAId, dayNumber: 21 },
      ],
    });
    await prisma.roomTask.create({
      data: {
        roomId: fixture.roomAId,
        title: 'Wash water filters',
        kind: 'recurring',
        cadence: 'weekly',
        weekdays: 'tue,fri',
        status: 'open',
      },
    });
    await prisma.room.create({
      data: {
        siteId: fixture.siteAId,
        name: 'Dry staging',
        code: 'DRY-BOARD',
        roomType: 'dry',
      },
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    tokenA = await login(fixture.siteAUser.email, fixture.siteAUser.password);
    tokenB = await login(fixture.siteBUser.email, fixture.siteBUser.password);
  });

  afterAll(async () => {
    await prisma.roomTask.deleteMany({ where: { roomId: fixture.roomAId } });
    await prisma.roomDefoliation.deleteMany({ where: { roomId: fixture.roomAId } });
    await prisma.roomTransplant.deleteMany({ where: { roomId: fixture.roomAId } });
    await prisma.cropCycle.deleteMany({ where: { roomId: fixture.roomAId, name: 'Board crop' } });
    await prisma.room.deleteMany({ where: { siteId: fixture.siteAId, code: 'DRY-BOARD' } });
    await prisma.$disconnect();
    if (app) {
      await app.close();
    }
  });

  it('builds a rooms × milestones board with defoliation, transplant, and harvest dates', async () => {
    const denied = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/board`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(denied.status).toBe(403);

    const board = await request(app.getHttpServer())
      .get(`/sites/${fixture.siteAId}/board`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(board.body.siteId).toBe(fixture.siteAId);
    expect(board.body.columns.map((column: { key: string }) => column.key)).toEqual(
      expect.arrayContaining([
        'start',
        'defoliation-10',
        'defoliation-21',
        'defoliation-35',
        'harvest',
        'transplant',
        'water_filters',
      ]),
    );
    expect(board.body.columns.map((column: { key: string }) => column.key)).not.toContain('dripper');
    expect(board.body.columns.map((column: { key: string }) => column.key)).not.toContain('trim');

    expect(board.body.rows.every((item: { roomType: string }) => item.roomType !== 'dry')).toBe(true);
    expect(board.body.rows.some((item: { roomName: string }) => item.roomName === 'Dry staging')).toBe(false);

    const row = board.body.rows.find((item: { roomId: string }) => item.roomId === fixture.roomAId);
    expect(row).toBeTruthy();
    expect(row.cycleName).toBe('Board crop');

    const byKey = Object.fromEntries(row.cells.map((cell: { columnKey: string }) => [cell.columnKey, cell]));
    expect(byKey.start).toMatchObject({ dates: ['2026-10-01'], source: 'cycle' });
    expect(byKey['defoliation-10']).toMatchObject({ dates: ['2026-10-10'], source: 'defoliation' });
    expect(byKey['defoliation-21']).toMatchObject({ dates: ['2026-10-21'], source: 'defoliation' });
    expect(byKey['defoliation-35']).toMatchObject({ dates: ['2026-11-04'], source: 'defoliation' });
    expect(byKey.harvest).toMatchObject({ dates: ['2026-12-01'], source: 'harvest' });
    expect(byKey.transplant).toMatchObject({
      dates: ['2026-10-07', '2026-10-21'],
      source: 'transplant',
      detail: 'Day 7 · Day 21',
    });
    expect(byKey.water_filters).toMatchObject({
      source: 'room_task',
      detail: 'Wash water filters',
      status: 'scheduled',
    });
    // Built-in schedules when no matching task exists.
    expect(byKey.sulfur).toMatchObject({
      dates: ['2026-10-14'],
      source: 'schedule',
      detail: 'Sulfur · day 14',
    });
    expect(byKey.side_net).toMatchObject({
      dates: ['2026-11-04'],
      source: 'schedule',
      detail: 'Side net · day 35',
    });
    expect(byKey.filters_ac).toMatchObject({
      dates: ['2026-11-04'],
      source: 'schedule',
      detail: 'AC / dehu filters · day 35',
    });
    expect(byKey.ls).toMatchObject({
      dates: ['2026-11-20'],
      source: 'schedule',
      detail: 'LS · 11 days before harvest',
    });
    expect(byKey.garden_clean).toMatchObject({
      source: 'schedule',
      detail: 'Garden clean · every 30 days',
    });
    expect(byKey.garden_clean.dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(byKey.fans_ac).toMatchObject({
      source: 'schedule',
      detail: 'Fans / ACs · every Friday',
    });
    expect(board.body.notes).toEqual([]);
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(200);
    return response.body.accessToken as string;
  }
});
