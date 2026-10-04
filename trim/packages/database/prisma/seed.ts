import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEV_USERS = {
  admin: {
    email: 'avery.chen@harborhill.example',
    name: 'Avery Chen',
    password: 'HarborHill-admin',
    role: 'org_admin' as const,
    siteCodes: [] as string[],
  },
  harbor: {
    email: 'blake.ortiz@harborhill.example',
    name: 'Blake Ortiz',
    password: 'HarborHouse-only',
    role: 'site_operator' as const,
    siteCodes: ['HARBOR'],
  },
  hill: {
    email: 'casey.nguyen@harborhill.example',
    name: 'Casey Nguyen',
    password: 'HillWorks-only',
    role: 'site_operator' as const,
    siteCodes: ['HILL'],
  },
};

const PERMISSIONS = [
  { key: 'dashboard.read', description: 'Open the main dashboard' },
  { key: 'access.manage', description: 'Manage users, roles, permissions, and view the full audit log' },
  { key: 'organization.read', description: 'View the organization profile' },
  { key: 'facilities.read', description: 'View facilities' },
  { key: 'facilities.write', description: 'Add, edit, or delete facilities' },
  { key: 'sites.read', description: 'View facilities the user is allowed to open' },
  { key: 'rooms.read', description: 'View rooms inside an authorized facility' },
  { key: 'rooms.write', description: 'Add, edit, reset, or delete rooms and room settings' },
  { key: 'zones.read', description: 'View zones inside an authorized room' },
  { key: 'zones.write', description: 'Add, edit, or delete zones' },
  { key: 'tasks.read', description: 'View crop-cycle, room, and workspace tasks' },
  { key: 'tasks.write', description: 'Create, edit, or complete tasks' },
  { key: 'timeclock.punch', description: 'Clock in, lunch, and clock out' },
  { key: 'timeclock.manage', description: 'View payroll, set labor rates, and ask AI payroll' },
  { key: 'compliance.read', description: 'View compliance and Metrc submissions' },
  { key: 'compliance.write', description: 'Create or change compliance submissions' },
  { key: 'harvests.read', description: 'View harvests and packages' },
  { key: 'harvests.write', description: 'Record or change harvests and packages' },
  { key: 'operations.read', description: 'View Operations lists' },
  { key: 'operations.write', description: 'Add or change Operations records' },
  { key: 'reports.read', description: 'View reports and dashboard analytics' },
  { key: 'coach.use', description: 'Use Serenity, the cultivation AI' },
  { key: 'messages.use', description: 'Send and read internal messages' },
  { key: 'settings.manage', description: 'Change organization settings and API credentials' },
  { key: 'workflows.manage', description: 'Manage workflow templates and teams' },
  { key: 'inventory.read', description: 'View plants and license inventory' },
  { key: 'inventory.write', description: 'Change plants and license inventory' },
];

const OPERATOR_PERMISSION_KEYS = new Set([
  'dashboard.read',
  'organization.read',
  'facilities.read',
  'sites.read',
  'rooms.read',
  'rooms.write',
  'zones.read',
  'zones.write',
  'tasks.read',
  'tasks.write',
  'timeclock.punch',
  'compliance.read',
  'compliance.write',
  'harvests.read',
  'harvests.write',
  'operations.read',
  'operations.write',
  'reports.read',
  'coach.use',
  'messages.use',
  'inventory.read',
  'inventory.write',
]);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV=production.');
  }

  const organization = await prisma.organization.upsert({
    where: { slug: 'harbor-hill' },
    create: { name: 'Harbor & Hill Cultivation', slug: 'harbor-hill' },
    update: { name: 'Harbor & Hill Cultivation' },
  });

  const permissions = new Map<string, string>();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
    permissions.set(row.key, row.id);
  }

  const orgAdmin = await prisma.role.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: 'org_admin' } },
    create: {
      organizationId: organization.id,
      key: 'org_admin',
      name: 'Organization admin',
      description: 'Opens every facility in the organization.',
      isOrgWide: true,
    },
    update: {
      name: 'Organization admin',
      description: 'Opens every facility in the organization.',
      isOrgWide: true,
    },
  });

  const siteOperator = await prisma.role.upsert({
    where: { organizationId_key: { organizationId: organization.id, key: 'site_operator' } },
    create: {
      organizationId: organization.id,
      key: 'site_operator',
      name: 'Site operator',
      description: 'Opens only facilities granted by a site membership.',
      isOrgWide: false,
    },
    update: {
      name: 'Site operator',
      description: 'Opens only facilities granted by a site membership.',
      isOrgWide: false,
    },
  });

  for (const permissionId of permissions.values()) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: orgAdmin.id, permissionId } },
      create: { roleId: orgAdmin.id, permissionId },
      update: {},
    });
  }
  for (const [key, permissionId] of permissions.entries()) {
    if (!OPERATOR_PERMISSION_KEYS.has(key)) {
      continue;
    }
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: siteOperator.id, permissionId } },
      create: { roleId: siteOperator.id, permissionId },
      update: {},
    });
  }

  const harbor = await upsertSite(organization.id, {
    code: 'HARBOR',
    name: 'Harbor House',
    addressLine1: '180 Cannery Road',
    city: 'Astoria',
    region: 'OR',
    postalCode: '97103',
    timezone: 'America/Los_Angeles',
  });

  const hill = await upsertSite(organization.id, {
    code: 'HILL',
    name: 'Hill Works',
    addressLine1: '42 Ridge Lane',
    city: 'Hood River',
    region: 'OR',
    postalCode: '97031',
    timezone: 'America/Los_Angeles',
  });

  const flower = await upsertRoom(harbor.id, 'FL1', 'Flower 1', 'flower', [
    ['EAST', 'East canopy'],
    ['WEST', 'West canopy'],
  ]);
  await upsertRoom(harbor.id, 'DRY', 'Dry Room', 'dry', [['HANG', 'Hang bay']]);
  const veg = await upsertRoom(hill.id, 'VG1', 'Veg 1', 'veg', [
    ['NORTH', 'North tables'],
    ['SOUTH', 'South tables'],
  ]);
  await upsertRoom(hill.id, 'MOM', 'Mother Room', 'mother', [['STOCK', 'Stock bench']]);

  const cedar = await upsertActiveCycle(flower.id, {
    name: 'Cedar Nights flower',
    cultivar: 'Cedar Nights',
    plantCount: 144,
    stage: 'flower',
    startDate: new Date('2026-09-12T00:00:00.000Z'),
    expectedHarvestDate: new Date('2026-10-24T00:00:00.000Z'),
    events: [
      {
        occurredOn: new Date('2026-09-12T00:00:00.000Z'),
        title: 'Cycle opened',
        detail: 'Plants were counted onto the flower tables.',
      },
      {
        occurredOn: new Date('2026-09-19T00:00:00.000Z'),
        title: 'Flower flip',
        detail: 'Photoperiod set to 12 hours.',
      },
    ],
    movements: [
      {
        occurredOn: new Date('2026-09-12T00:00:00.000Z'),
        fromLabel: 'Mother Room',
        toLabel: 'Flower 1',
        plantCount: 144,
        note: 'Counted at the door.',
      },
    ],
    observations: [
      {
        occurredOn: new Date('2026-09-28T00:00:00.000Z'),
        authorName: 'Blake Ortiz',
        body: 'East canopy is even. No pests on the scout.',
      },
    ],
    laborEntries: [
      {
        occurredOn: new Date('2026-09-26T00:00:00.000Z'),
        personName: 'Blake Ortiz',
        hours: 5.5,
        note: 'Lower-leaf cleanup',
      },
    ],
  });

  const glass = await upsertActiveCycle(veg.id, {
    name: 'Glass Orchard veg',
    cultivar: 'Glass Orchard',
    plantCount: 86,
    stage: 'veg',
    startDate: new Date('2026-09-20T00:00:00.000Z'),
    expectedHarvestDate: new Date('2026-11-15T00:00:00.000Z'),
    events: [
      {
        occurredOn: new Date('2026-09-20T00:00:00.000Z'),
        title: 'Cycle opened',
        detail: 'Rooted cuts moved under the veg lights.',
      },
    ],
    movements: [
      {
        occurredOn: new Date('2026-09-20T00:00:00.000Z'),
        fromLabel: 'Mother Room',
        toLabel: 'Veg 1',
        plantCount: 86,
        note: 'One tray held back for a weak root.',
      },
    ],
    observations: [
      {
        occurredOn: new Date('2026-10-01T00:00:00.000Z'),
        authorName: 'Casey Nguyen',
        body: 'South tables need another day before topping.',
      },
    ],
    laborEntries: [
      {
        occurredOn: new Date('2026-10-02T00:00:00.000Z'),
        personName: 'Casey Nguyen',
        hours: 4,
        note: 'Topping and stake check',
      },
    ],
  });

  const harborLicense = await upsertLicense(organization.id, 'OR-CULT-44821', harbor.id);
  const hillLicense = await upsertLicense(organization.id, 'OR-CULT-55218', hill.id);
  await prisma.licenseSite.deleteMany({
    where: { licenseId: harborLicense.id, siteId: hill.id },
  });

  const sitesByCode = new Map([
    ['HARBOR', harbor.id],
    ['HILL', hill.id],
  ]);
  const rolesByKey = new Map([
    ['org_admin', orgAdmin.id],
    ['site_operator', siteOperator.id],
  ]);

  for (const user of Object.values(DEV_USERS)) {
    await upsertUser(organization.id, user, sitesByCode, rolesByKey);
  }

  const blake = await prisma.user.findUniqueOrThrow({ where: { email: DEV_USERS.harbor.email } });
  const casey = await prisma.user.findUniqueOrThrow({ where: { email: DEV_USERS.hill.email } });
  await seedCanopyWeek(organization.id, siteOperator.id, [blake.id, casey.id], [flower.id, veg.id]);
  await seedInventory({
    organizationId: organization.id,
    harborLicenseId: harborLicense.id,
    hillLicenseId: hillLicense.id,
    hillSiteId: hill.id,
    cedarCycleId: cedar.id,
    glassCycleId: glass.id,
    flowerRoomId: flower.id,
    vegRoomId: veg.id,
    blakeId: blake.id,
    caseyId: casey.id,
  });
  await seedEnvironment(flower.id, veg.id);
  await seedAnalytics({
    organizationId: organization.id,
    cedarCycleId: cedar.id,
    glassCycleId: glass.id,
    harborLicenseId: harborLicense.id,
    harborSiteId: harbor.id,
    blakeId: blake.id,
  });
  await seedAdapters(harbor.id, hill.id, flower.id);
  await seedOperations({
    organizationId: organization.id,
    harborSiteId: harbor.id,
    hillSiteId: hill.id,
    flowerRoomId: flower.id,
    vegRoomId: veg.id,
    operatorRoleId: siteOperator.id,
  });

  console.log('Seeded Harbor & Hill Cultivation.');
  console.log('Dev-only logins (also listed in the README):');
  for (const user of Object.values(DEV_USERS)) {
    console.log(`  ${user.email}  ${user.password}`);
  }
}

async function upsertSite(
  organizationId: string,
  site: {
    code: string;
    name: string;
    addressLine1: string;
    city: string;
    region: string;
    postalCode: string;
    timezone: string;
  },
) {
  return prisma.site.upsert({
    where: { organizationId_code: { organizationId, code: site.code } },
    create: { organizationId, ...site },
    update: site,
  });
}

async function upsertRoom(
  siteId: string,
  code: string,
  name: string,
  roomType: string,
  zones: Array<[string, string]>,
) {
  const room = await prisma.room.upsert({
    where: { siteId_code: { siteId, code } },
    create: { siteId, code, name, roomType },
    update: { name, roomType },
  });

  for (const [zoneCode, zoneName] of zones) {
    await prisma.zone.upsert({
      where: { roomId_code: { roomId: room.id, code: zoneCode } },
      create: { roomId: room.id, code: zoneCode, name: zoneName },
      update: { name: zoneName },
    });
  }

  return room;
}

async function upsertActiveCycle(
  roomId: string,
  input: {
    name: string;
    cultivar: string;
    plantCount: number;
    stage: string;
    startDate: Date;
    expectedHarvestDate: Date;
    events: Array<{ occurredOn: Date; title: string; detail: string }>;
    movements: Array<{ occurredOn: Date; fromLabel: string; toLabel: string; plantCount: number; note: string }>;
    observations: Array<{ occurredOn: Date; authorName: string; body: string }>;
    laborEntries: Array<{ occurredOn: Date; personName: string; hours: number; note: string }>;
  },
) {
  const existing = await prisma.cropCycle.findFirst({ where: { roomId, name: input.name } });
  const cycle = existing
    ? await prisma.cropCycle.update({
        where: { id: existing.id },
        data: {
          cultivar: input.cultivar,
          plantCount: input.plantCount,
          stage: input.stage,
          startDate: input.startDate,
          expectedHarvestDate: input.expectedHarvestDate,
          status: 'active',
        },
      })
    : await prisma.cropCycle.create({
        data: {
          roomId,
          name: input.name,
          cultivar: input.cultivar,
          plantCount: input.plantCount,
          stage: input.stage,
          startDate: input.startDate,
          expectedHarvestDate: input.expectedHarvestDate,
          status: 'active',
        },
      });

  await prisma.cycleEvent.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.cycleMovement.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.cycleObservation.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.cycleLaborEntry.deleteMany({ where: { cycleId: cycle.id } });
  await prisma.harvestResultSummary.deleteMany({ where: { cycleId: cycle.id } });

  await prisma.cycleEvent.createMany({
    data: input.events.map((event) => ({ ...event, cycleId: cycle.id })),
  });
  await prisma.cycleMovement.createMany({
    data: input.movements.map((movement) => ({ ...movement, cycleId: cycle.id })),
  });
  await prisma.cycleObservation.createMany({
    data: input.observations.map((observation) => ({ ...observation, cycleId: cycle.id })),
  });
  await prisma.cycleLaborEntry.createMany({
    data: input.laborEntries.map((entry) => ({ ...entry, cycleId: cycle.id })),
  });
  return cycle;
}

async function upsertLicense(organizationId: string, licenseNumber: string, siteId: string) {
  const license = await prisma.license.upsert({
    where: { organizationId_licenseNumber: { organizationId, licenseNumber } },
    create: {
      organizationId,
      licenseNumber,
      licenseType: 'producer',
      jurisdiction: 'US-OR',
      status: 'active',
      issuedOn: new Date('2024-03-01'),
      expiresOn: new Date('2027-03-01'),
    },
    update: { licenseType: 'producer', jurisdiction: 'US-OR', status: 'active' },
  });
  await prisma.licenseSite.upsert({
    where: { licenseId_siteId: { licenseId: license.id, siteId } },
    create: { licenseId: license.id, siteId },
    update: {},
  });
  return license;
}

function inventoryTag(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(24 - prefix.length, '0')}`;
}

function compareInventoryTags(localTags: string[], importedTags: string[]) {
  const local = new Set(localTags);
  const imported = new Set(importedTags);
  return {
    matched: localTags.filter((tag) => imported.has(tag)),
    extraTags: importedTags.filter((tag) => !local.has(tag)),
    missingTags: localTags.filter((tag) => !imported.has(tag)),
  };
}

async function seedInventory(input: {
  organizationId: string;
  harborLicenseId: string;
  hillLicenseId: string;
  hillSiteId: string;
  cedarCycleId: string;
  glassCycleId: string;
  flowerRoomId: string;
  vegRoomId: string;
  blakeId: string;
  caseyId: string;
}) {
  const licenseIds = [input.harborLicenseId, input.hillLicenseId];
  await prisma.harvest.deleteMany({ where: { licenseId: { in: licenseIds } } });
  await prisma.metrcInventoryImport.deleteMany({ where: { licenseId: { in: licenseIds } } });
  await prisma.plant.deleteMany({ where: { licenseId: { in: licenseIds } } });
  await prisma.plantBatch.deleteMany({ where: { licenseId: { in: licenseIds } } });

  const cedarStrain = await prisma.strain.upsert({
    where: { organizationId_name: { organizationId: input.organizationId, name: 'Cedar Nights' } },
    create: { organizationId: input.organizationId, name: 'Cedar Nights' },
    update: {},
  });
  const glassStrain = await prisma.strain.upsert({
    where: { organizationId_name: { organizationId: input.organizationId, name: 'Glass Orchard' } },
    create: { organizationId: input.organizationId, name: 'Glass Orchard' },
    update: {},
  });

  const cedarBatch = await prisma.plantBatch.create({
    data: { licenseId: input.harborLicenseId, strainId: cedarStrain.id, name: 'Cedar Nights flower batch' },
  });
  const glassBatch = await prisma.plantBatch.create({
    data: { licenseId: input.hillLicenseId, strainId: glassStrain.id, name: 'Glass Orchard veg batch' },
  });

  const harborTags = Array.from({ length: 144 }, (_, index) => inventoryTag('1A4HH', index + 1));
  const hillTags = Array.from({ length: 86 }, (_, index) => inventoryTag('1A4HW', index + 1));
  const hillExtraTag = inventoryTag('1A4HW', 99999);

  await prisma.plant.createMany({
    data: harborTags.map((tag) => ({
      licenseId: input.harborLicenseId,
      batchId: cedarBatch.id,
      strainId: cedarStrain.id,
      cycleId: input.cedarCycleId,
      roomId: input.flowerRoomId,
      tag,
      stage: 'flower',
      status: 'active',
    })),
  });
  await prisma.plant.createMany({
    data: hillTags.map((tag) => ({
      licenseId: input.hillLicenseId,
      batchId: glassBatch.id,
      strainId: glassStrain.id,
      cycleId: input.glassCycleId,
      roomId: input.vegRoomId,
      tag,
      stage: 'veg',
      status: 'active',
    })),
  });

  const harborPlants = await prisma.plant.findMany({
    where: { licenseId: input.harborLicenseId },
    select: { id: true },
  });
  const hillPlants = await prisma.plant.findMany({
    where: { licenseId: input.hillLicenseId },
    select: { id: true },
  });
  await prisma.plantEvent.createMany({
    data: [
      ...harborPlants.map((plant) => ({
        plantId: plant.id,
        licenseId: input.harborLicenseId,
        eventType: 'planted',
        actorUserId: input.blakeId,
        occurredAt: new Date('2026-09-12T15:00:00.000Z'),
        toRoomId: input.flowerRoomId,
        toStage: 'flower',
        note: 'Counted onto Cedar Nights flower.',
      })),
      ...hillPlants.map((plant) => ({
        plantId: plant.id,
        licenseId: input.hillLicenseId,
        eventType: 'planted',
        actorUserId: input.caseyId,
        occurredAt: new Date('2026-09-20T15:00:00.000Z'),
        toRoomId: input.vegRoomId,
        toStage: 'veg',
        note: 'Counted onto Glass Orchard veg.',
      })),
    ],
  });

  await prisma.cropCycle.update({ where: { id: input.cedarCycleId }, data: { plantCount: harborTags.length } });
  await prisma.cropCycle.update({ where: { id: input.glassCycleId }, data: { plantCount: hillTags.length } });

  await recordFixtureImport(input.harborLicenseId, harborTags, harborTags, 'fixture');
  await recordFixtureImport(input.hillLicenseId, hillTags, [...hillTags, hillExtraTag], 'fixture');

  const unusedUserKey = process.env.METRC_USER_KEY || 'unused-dev-user-key';
  const unusedIntegratorKey = process.env.METRC_INTEGRATOR_KEY || 'unused-dev-integrator-key';
  for (const licenseId of licenseIds) {
    await prisma.metrcConnection.upsert({
      where: { licenseId },
      create: {
        licenseId,
        userKey: unusedUserKey,
        integratorKey: unusedIntegratorKey,
        baseUrl: 'https://api-or.metrc.example',
      },
      update: {
        userKey: unusedUserKey,
        integratorKey: unusedIntegratorKey,
        baseUrl: 'https://api-or.metrc.example',
      },
    });
  }

  await seedPendingSubmissions(input);
  await seedPriorHillHarvest(input);
}

async function seedPriorHillHarvest(input: { hillLicenseId: string; hillSiteId: string; caseyId: string }) {
  const harvest = await prisma.harvest.create({
    data: {
      licenseId: input.hillLicenseId,
      siteId: input.hillSiteId,
      name: 'Hill Works prior lot',
    },
  });
  await prisma.harvestStep.create({
    data: {
      harvestId: harvest.id,
      kind: 'harvested',
      actorUserId: input.caseyId,
      occurredAt: new Date('2026-08-01T16:00:00.000Z'),
      note: 'Prior lot. Veg 1 was not cut.',
    },
  });
}

async function seedPendingSubmissions(input: {
  harborLicenseId: string;
  hillLicenseId: string;
  flowerRoomId: string;
  blakeId: string;
  caseyId: string;
}) {
  const flower = await prisma.room.findUniqueOrThrow({ where: { id: input.flowerRoomId } });
  const dry = await prisma.room.findFirstOrThrow({ where: { siteId: flower.siteId, code: 'DRY' } });
  const [harborMovePlant, harborStagePlant] = await prisma.plant.findMany({
    where: { licenseId: input.harborLicenseId },
    orderBy: { tag: 'asc' },
    take: 2,
  });
  const hillPlant = await prisma.plant.findFirstOrThrow({
    where: { licenseId: input.hillLicenseId },
    orderBy: { tag: 'asc' },
  });
  if (!harborMovePlant || !harborStagePlant) {
    throw new Error('Harbor plants were not seeded');
  }

  await prisma.plant.update({ where: { id: harborMovePlant.id }, data: { roomId: dry.id } });
  const move = await prisma.plantEvent.create({
    data: {
      plantId: harborMovePlant.id,
      licenseId: input.harborLicenseId,
      eventType: 'moved',
      actorUserId: input.blakeId,
      occurredAt: new Date('2026-10-03T17:00:00.000Z'),
      fromRoomId: input.flowerRoomId,
      toRoomId: dry.id,
      note: 'Submit the Harbor House move.',
    },
  });
  await prisma.plant.update({ where: { id: hillPlant.id }, data: { stage: 'flower' } });
  const hillStage = await prisma.plantEvent.create({
    data: {
      plantId: hillPlant.id,
      licenseId: input.hillLicenseId,
      eventType: 'stage_changed',
      actorUserId: input.caseyId,
      occurredAt: new Date('2026-10-03T17:05:00.000Z'),
      fromStage: 'veg',
      toStage: 'flower',
      note: 'Submit the Hill Works stage change.',
    },
  });
  await prisma.plant.update({ where: { id: harborStagePlant.id }, data: { stage: 'ripen' } });
  const harborStage = await prisma.plantEvent.create({
    data: {
      plantId: harborStagePlant.id,
      licenseId: input.harborLicenseId,
      eventType: 'stage_changed',
      actorUserId: input.blakeId,
      occurredAt: new Date('2026-10-03T17:10:00.000Z'),
      fromStage: 'flower',
      toStage: 'ripen',
      note: 'Submit the Harbor House stage change.',
    },
  });

  const pending = [
    { event: move, licenseId: input.harborLicenseId, requestedById: input.blakeId, sandboxOutcome: 'success', requestedAt: new Date('2026-10-03T17:01:00.000Z') },
    { event: hillStage, licenseId: input.hillLicenseId, requestedById: input.caseyId, sandboxOutcome: 'failure', requestedAt: new Date('2026-10-03T17:06:00.000Z') },
    { event: harborStage, licenseId: input.harborLicenseId, requestedById: input.blakeId, sandboxOutcome: 'uncertain', requestedAt: new Date('2026-10-03T17:11:00.000Z') },
  ];
  for (const row of pending) {
    await prisma.metrcSubmission.create({
      data: {
        licenseId: row.licenseId,
        plantEventId: row.event.id,
        status: 'pending_review',
        sandboxOutcome: row.sandboxOutcome,
        requestedById: row.requestedById,
        requestedAt: row.requestedAt,
      },
    });
  }
}

async function recordFixtureImport(licenseId: string, localTags: string[], importedTags: string[], source: string) {
  const comparison = compareInventoryTags(localTags, importedTags);
  const discrepancies = [
    ...comparison.extraTags.map((tag) => ({ licenseId, tag, kind: 'extra_tag' })),
    ...comparison.missingTags.map((tag) => ({ licenseId, tag, kind: 'missing_tag' })),
  ];
  await prisma.metrcInventoryImport.create({
    data: {
      licenseId,
      source,
      status: 'reconciled',
      matchedCount: comparison.matched.length,
      discrepancyCount: discrepancies.length,
      importedAt: new Date('2026-10-03T16:00:00.000Z'),
      discrepancies: { create: discrepancies },
    },
  });
}

async function upsertUser(
  organizationId: string,
  input: {
    email: string;
    name: string;
    password: string;
    role: 'org_admin' | 'site_operator';
    siteCodes: string[];
  },
  sitesByCode: Map<string, string>,
  rolesByKey: Map<string, string>,
): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: { organizationId, email: input.email, name: input.name },
    update: { organizationId, name: input.name },
  });

  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.credential.upsert({
    where: { userId: user.id },
    create: { userId: user.id, passwordHash },
    update: { passwordHash },
  });

  const roleId = rolesByKey.get(input.role);
  if (!roleId) {
    throw new Error(`Missing role ${input.role}`);
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId } },
    create: { userId: user.id, roleId },
    update: {},
  });

  for (const code of input.siteCodes) {
    const siteId = sitesByCode.get(code);
    if (!siteId) {
      throw new Error(`Missing site ${code}`);
    }
    await prisma.siteMembership.upsert({
      where: { userId_siteId: { userId: user.id, siteId } },
      create: { userId: user.id, siteId },
      update: {},
    });
  }
}

const CANOPY_TASKS = [
  {
    taskKey: 'count',
    title: 'Count plants onto the bench',
    offsetDays: 0,
    instructions: 'Count every plant at the table and note gaps before the lights come up.',
    checklist: ['Count the bench', 'Note missing plants', 'Initial the count sheet'],
    requiresNotes: true,
    requiresMeasurement: false,
    requiresPhoto: false,
    requiresSignOff: true,
    dependsOnKey: null as string | null,
    requiresApproval: false,
    sopTitle: null as string | null,
  },
  {
    taskKey: 'scout',
    title: 'Scout the canopy',
    offsetDays: 13,
    instructions: 'Walk each table. Record pests, stretch, and any plant that is falling behind.',
    checklist: ['Check the first half of the room', 'Check the second half of the room'],
    requiresNotes: true,
    requiresMeasurement: true,
    requiresPhoto: true,
    requiresSignOff: false,
    dependsOnKey: 'count',
    requiresApproval: false,
    sopTitle: 'Canopy scout',
  },
  {
    taskKey: 'defoliate',
    title: 'Lower-leaf pass',
    offsetDays: 21,
    instructions: 'Remove fan leaves that shade the lower sites. Bag leaves before leaving the room.',
    checklist: ['Clear the aisle', 'Bag the leaves'],
    requiresNotes: false,
    requiresMeasurement: false,
    requiresPhoto: true,
    requiresSignOff: true,
    dependsOnKey: 'scout',
    requiresApproval: true,
    sopTitle: null as string | null,
  },
];

async function seedCanopyWeek(
  organizationId: string,
  operatorRoleId: string,
  memberIds: string[],
  roomIds: string[],
): Promise<void> {
  const sop = await prisma.sopRecord.upsert({
    where: { organizationId_title: { organizationId, title: 'Canopy scout' } },
    create: {
      organizationId,
      title: 'Canopy scout',
      summary: 'Walk the canopy slowly. Note pests, stretch, and irrigation dry-back. Do not spray during this pass.',
    },
    update: {
      summary: 'Walk the canopy slowly. Note pests, stretch, and irrigation dry-back. Do not spray during this pass.',
    },
  });

  const team = await prisma.team.upsert({
    where: { organizationId_name: { organizationId, name: 'Canopy crew' } },
    create: { organizationId, name: 'Canopy crew' },
    update: {},
  });
  for (const userId of memberIds) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId } },
      create: { teamId: team.id, userId },
      update: {},
    });
  }

  const template = await prisma.workflowTemplate.upsert({
    where: { organizationId_name: { organizationId, name: 'Canopy week' } },
    create: { organizationId, name: 'Canopy week' },
    update: {},
  });
  const version = await prisma.workflowTemplateVersion.upsert({
    where: { templateId_versionNumber: { templateId: template.id, versionNumber: 1 } },
    create: {
      templateId: template.id,
      versionNumber: 1,
      durationDays: 28,
      startingEvent: 'cycle_start',
    },
    update: { durationDays: 28, startingEvent: 'cycle_start' },
  });

  await prisma.workflowChecklistItem.deleteMany({ where: { task: { versionId: version.id } } });
  await prisma.workflowTaskTemplate.deleteMany({ where: { versionId: version.id } });
  const created = new Map<string, string>();
  for (const [index, task] of CANOPY_TASKS.entries()) {
    const row = await prisma.workflowTaskTemplate.create({
      data: {
        versionId: version.id,
        taskKey: task.taskKey,
        title: task.title,
        offsetDays: task.offsetDays,
        sortOrder: index,
        assigneeType: 'role',
        roleId: operatorRoleId,
        instructions: task.instructions,
        sopRecordId: task.sopTitle ? sop.id : null,
        requiresNotes: task.requiresNotes,
        requiresMeasurement: task.requiresMeasurement,
        requiresPhoto: task.requiresPhoto,
        requiresSignOff: task.requiresSignOff,
        dependsOnKey: task.dependsOnKey,
        requiresApproval: task.requiresApproval,
        checklist: { create: task.checklist.map((label, sortOrder) => ({ label, sortOrder })) },
      },
    });
    created.set(task.taskKey, row.id);
  }

  for (const roomId of roomIds) {
    const cycle = await prisma.cropCycle.findFirst({
      where: { roomId, status: 'active' },
      orderBy: { startDate: 'desc' },
    });
    if (!cycle) {
      continue;
    }
    await prisma.cropCycle.update({ where: { id: cycle.id }, data: { workflowVersionId: version.id } });
    await prisma.cycleTask.updateMany({ where: { cycleId: cycle.id }, data: { dependsOnTaskId: null } });
    await prisma.cycleTask.deleteMany({ where: { cycleId: cycle.id } });
    const taskIds = new Map<string, string>();
    for (const task of CANOPY_TASKS) {
      const row = await prisma.cycleTask.create({
        data: {
          cycleId: cycle.id,
          roomId,
          sourceTemplateId: created.get(task.taskKey),
          taskKey: task.taskKey,
          title: task.title,
          instructions: task.instructions,
          offsetDays: task.offsetDays,
          dueOn: addUtcDays(cycle.startDate, task.offsetDays),
          assigneeType: 'role',
          roleId: operatorRoleId,
          assigneeLabel: 'Site operator',
          sopRecordId: task.sopTitle ? sop.id : null,
          requiresNotes: task.requiresNotes,
          requiresMeasurement: task.requiresMeasurement,
          requiresPhoto: task.requiresPhoto,
          requiresSignOff: task.requiresSignOff,
          requiresApproval: task.requiresApproval,
          checklist: { create: task.checklist.map((label, sortOrder) => ({ label, sortOrder })) },
        },
      });
      taskIds.set(task.taskKey, row.id);
    }
    for (const task of CANOPY_TASKS) {
      if (!task.dependsOnKey) {
        continue;
      }
      const taskId = taskIds.get(task.taskKey);
      const dependsOnTaskId = taskIds.get(task.dependsOnKey);
      if (taskId && dependsOnTaskId) {
        await prisma.cycleTask.update({ where: { id: taskId }, data: { dependsOnTaskId } });
      }
    }
  }
}

async function seedEnvironment(flowerRoomId: string, vegRoomId: string): Promise<void> {
  const roomIds = [flowerRoomId, vegRoomId];
  await prisma.roomAlert.deleteMany({ where: { roomId: { in: roomIds } } });
  await prisma.alertRule.deleteMany({ where: { roomId: { in: roomIds } } });
  await prisma.environmentalReading.deleteMany({ where: { roomId: { in: roomIds } } });
  await prisma.room.updateMany({ where: { id: { in: roomIds } }, data: { staleAfterMinutes: 60 } });

  const now = Date.now();
  const flowerTemps = [
    { ageMs: 6 * 60 * 60 * 1000, value: 72.4 },
    { ageMs: 4 * 60 * 60 * 1000, value: 73.1 },
    { ageMs: 2 * 60 * 60 * 1000, value: 74 },
    { ageMs: 10 * 60 * 1000, value: 74.6 },
  ];
  for (const point of flowerTemps) {
    await prisma.environmentalReading.create({
      data: {
        roomId: flowerRoomId,
        deviceId: 'hh-flower-1-temp',
        metric: 'temperature',
        value: point.value,
        unit: '°F',
        quality: 'good',
        isSample: false,
        recordedAt: new Date(now - point.ageMs),
      },
    });
  }
  await prisma.environmentalReading.create({
    data: {
      roomId: flowerRoomId,
      deviceId: 'hh-flower-1-rh',
      metric: 'relative_humidity',
      value: 58.2,
      unit: '%',
      quality: 'good',
      isSample: false,
      recordedAt: new Date(now - 3 * 60 * 60 * 1000),
    },
  });
  await prisma.environmentalReading.create({
    data: {
      roomId: flowerRoomId,
      deviceId: 'sample-co2-logger',
      metric: 'co2',
      value: 1120,
      unit: 'ppm',
      quality: 'good',
      isSample: true,
      recordedAt: new Date(now - 5 * 60 * 1000),
    },
  });
  const humidityRule = await prisma.alertRule.create({
    data: {
      roomId: flowerRoomId,
      metric: 'relative_humidity',
      kind: 'stale',
      enabled: true,
    },
  });
  await prisma.roomAlert.create({
    data: {
      roomId: flowerRoomId,
      ruleId: humidityRule.id,
      metric: 'relative_humidity',
      kind: 'stale',
      active: true,
      message: 'Relative humidity is stale. No reading is newer than 60 minutes.',
    },
  });
  await prisma.environmentalReading.create({
    data: {
      roomId: vegRoomId,
      deviceId: 'hw-veg-1-temp',
      metric: 'temperature',
      value: 76.1,
      unit: '°F',
      quality: 'good',
      isSample: false,
      recordedAt: new Date(now - 8 * 60 * 1000),
    },
  });
}

async function seedAnalytics(input: {
  organizationId: string;
  cedarCycleId: string;
  glassCycleId: string;
  harborLicenseId: string;
  harborSiteId: string;
  blakeId: string;
}): Promise<void> {
  await prisma.laborRate.upsert({
    where: { organizationId_personName: { organizationId: input.organizationId, personName: 'Blake Ortiz' } },
    create: { organizationId: input.organizationId, personName: 'Blake Ortiz', hourlyCents: 2800 },
    update: { hourlyCents: 2800 },
  });
  await prisma.laborRate.upsert({
    where: { organizationId_personName: { organizationId: input.organizationId, personName: 'Casey Nguyen' } },
    create: { organizationId: input.organizationId, personName: 'Casey Nguyen', hourlyCents: 2600 },
    update: { hourlyCents: 2600 },
  });
  await prisma.cycleInputCost.deleteMany({
    where: { cycleId: { in: [input.cedarCycleId, input.glassCycleId] } },
  });
  await prisma.cycleInputCost.createMany({
    data: [
      {
        cycleId: input.cedarCycleId,
        description: 'Flower nutrients',
        quantity: 2,
        unit: 'bag',
        unitCostCents: 1500,
      },
      {
        cycleId: input.glassCycleId,
        description: 'Veg media',
        quantity: 1,
        unit: 'bag',
        unitCostCents: 4200,
      },
    ],
  });

  const cycle = await prisma.cropCycle.findUniqueOrThrow({ where: { id: input.cedarCycleId } });
  const plants = await prisma.plant.findMany({
    where: { cycleId: input.cedarCycleId },
    orderBy: { tag: 'asc' },
  });
  if (plants.length !== 144) {
    throw new Error(`Cedar Nights expected 144 plants to harvest, found ${plants.length}.`);
  }
  const harvestedAt = new Date('2026-10-03T16:00:00.000Z');
  const harvest = await prisma.harvest.create({
    data: {
      licenseId: input.harborLicenseId,
      siteId: input.harborSiteId,
      cycleId: input.cedarCycleId,
      roomId: cycle.roomId,
      name: 'Cedar Nights flower harvest',
    },
  });
  await prisma.harvestPlant.createMany({
    data: plants.map((plant) => ({ harvestId: harvest.id, plantId: plant.id, tag: plant.tag })),
  });
  await prisma.harvestStep.createMany({
    data: [
      {
        harvestId: harvest.id,
        kind: 'harvested',
        actorUserId: input.blakeId,
        occurredAt: harvestedAt,
        note: '144 plants recorded with their tags.',
      },
      {
        harvestId: harvest.id,
        kind: 'wet_weight',
        actorUserId: input.blakeId,
        occurredAt: new Date('2026-10-03T17:00:00.000Z'),
        weightGrams: 18240,
      },
      {
        harvestId: harvest.id,
        kind: 'drying',
        actorUserId: input.blakeId,
        occurredAt: new Date('2026-10-03T18:00:00.000Z'),
        roomId: cycle.roomId,
      },
      {
        harvestId: harvest.id,
        kind: 'dry_weight',
        actorUserId: input.blakeId,
        occurredAt: new Date('2026-10-03T19:00:00.000Z'),
        weightGrams: 4120,
      },
      {
        harvestId: harvest.id,
        kind: 'trimming',
        actorUserId: input.blakeId,
        occurredAt: new Date('2026-10-03T20:00:00.000Z'),
      },
    ],
  });
  await prisma.harvestWaste.create({
    data: {
      harvestId: harvest.id,
      weightGrams: 240,
      note: 'Fan leaves and stem',
      actorUserId: input.blakeId,
      recordedAt: new Date('2026-10-03T21:00:00.000Z'),
    },
  });
  const packaged = await prisma.harvestPackage.create({
    data: {
      harvestId: harvest.id,
      licenseId: input.harborLicenseId,
      label: '1A4PKGCEDARNIGHTS00001',
      weightGrams: 3600,
      actorUserId: input.blakeId,
      recordedAt: new Date('2026-10-03T22:00:00.000Z'),
    },
  });
  const harvestPlants = await prisma.harvestPlant.findMany({ where: { harvestId: harvest.id } });
  await prisma.harvestPackagePlant.createMany({
    data: harvestPlants.map((plant) => ({
      packageId: packaged.id,
      harvestPlantId: plant.id,
      tag: plant.tag,
    })),
  });
  await prisma.plantEvent.createMany({
    data: plants.map((plant) => ({
      plantId: plant.id,
      licenseId: input.harborLicenseId,
      eventType: 'harvested',
      actorUserId: input.blakeId,
      occurredAt: harvestedAt,
      fromRoomId: plant.roomId,
      fromStage: plant.stage,
      toStage: 'harvested',
      note: 'Harvested on Cedar Nights flower harvest.',
    })),
  });
  await prisma.plant.updateMany({
    where: { id: { in: plants.map((plant) => plant.id) } },
    data: { status: 'harvested', stage: 'harvested', cycleId: null },
  });
}

async function seedAdapters(harborSiteId: string, hillSiteId: string, flowerRoomId: string) {
  await prisma.sensorGateway.upsert({
    where: { siteId_name: { siteId: harborSiteId, name: 'Harbor House environment' } },
    update: {},
    create: { siteId: harborSiteId, name: 'Harbor House environment' },
  });
  await prisma.sensorGateway.upsert({
    where: { siteId_name: { siteId: hillSiteId, name: 'Hill Works environment' } },
    update: {},
    create: { siteId: hillSiteId, name: 'Hill Works environment' },
  });

  await prisma.controllerReading.deleteMany({
    where: { roomId: flowerRoomId, deviceId: 'hh-flower-1-controller' },
  });
  await prisma.controllerReading.create({
    data: {
      roomId: flowerRoomId,
      deviceId: 'hh-flower-1-controller',
      metric: 'setpoint',
      value: 72,
      unit: '°F',
      quality: 'good',
      isSample: true,
      recordedAt: new Date(Date.now() - 2 * 60 * 1000),
    },
  });

  const harvest = await prisma.harvest.findFirst({
    where: { name: 'Cedar Nights flower harvest', siteId: harborSiteId },
  });
  if (!harvest) {
    throw new Error('Cedar Nights flower harvest is missing, so the scale sample cannot be stored.');
  }
  await prisma.scaleSample.deleteMany({
    where: { harvestId: harvest.id, deviceId: 'hh-sample-scale' },
  });
  await prisma.scaleSample.create({
    data: {
      harvestId: harvest.id,
      deviceId: 'hh-sample-scale',
      weightGrams: 510,
      unit: 'g',
      quality: 'good',
      isSample: true,
      recordedAt: new Date('2026-10-03T22:30:00.000Z'),
    },
  });
  await prisma.harvestTagSample.deleteMany({
    where: { harvestId: harvest.id, deviceId: 'hh-sample-rfid' },
  });
  await prisma.harvestTagSample.create({
    data: {
      harvestId: harvest.id,
      deviceId: 'hh-sample-rfid',
      tag: '1A4HH000000000000000001',
      quality: 'good',
      isSample: true,
      recordedAt: new Date('2026-10-03T22:40:00.000Z'),
    },
  });
}

async function seedOperations(input: {
  organizationId: string;
  harborSiteId: string;
  hillSiteId: string;
  flowerRoomId: string;
  vegRoomId: string;
  operatorRoleId: string;
}): Promise<void> {
  const irrigationSop = await prisma.sopRecord.upsert({
    where: { organizationId_title: { organizationId: input.organizationId, title: 'Irrigation pass' } },
    create: {
      organizationId: input.organizationId,
      title: 'Irrigation pass',
      summary: 'Confirm the drip lines are open, then record volume, EC, and pH before you leave the room.',
    },
    update: {},
  });
  const ipmSop = await prisma.sopRecord.upsert({
    where: { organizationId_title: { organizationId: input.organizationId, title: 'IPM scout' } },
    create: {
      organizationId: input.organizationId,
      title: 'IPM scout',
      summary: 'Check leaves and medium. Record the target even when the room is clear. Do not apply a spray on this pass.',
    },
    update: {},
  });
  await prisma.sopRecord.upsert({
    where: { organizationId_title: { organizationId: input.organizationId, title: 'Room sanitation' } },
    create: {
      organizationId: input.organizationId,
      title: 'Room sanitation',
      summary: 'Wipe benches and floors after the plants are clear of the aisle. Record the method and whether a follow-up is needed.',
    },
    update: {},
  });

  await seedCultivarTemplate({
    organizationId: input.organizationId,
    name: 'Cedar Nights coco week',
    cultivar: 'Cedar Nights',
    medium: 'coco',
    roleId: input.operatorRoleId,
    taskKey: 'runoff',
    taskTitle: 'Check runoff',
    sopId: irrigationSop.id,
  });
  await seedCultivarTemplate({
    organizationId: input.organizationId,
    name: 'Glass Orchard soil week',
    cultivar: 'Glass Orchard',
    medium: 'soil',
    roleId: input.operatorRoleId,
    taskKey: 'scout',
    taskTitle: 'Scout the benches',
    sopId: ipmSop.id,
  });

  const siteIds = [input.harborSiteId, input.hillSiteId];
  await prisma.irrigationRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.ipmRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.maintenanceRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.purchaseRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.sanitationRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.trainingRecord.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.roomStay.deleteMany({ where: { siteId: { in: siteIds } } });
  await prisma.recurringDuty.deleteMany({ where: { siteId: { in: siteIds } } });

  await prisma.irrigationRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        recordedOn: new Date('2026-10-02T00:00:00.000Z'),
        kind: 'feed',
        method: 'Drip',
        volumeLiters: 12,
        ec: 1.8,
        ph: 5.9,
        nutrientName: 'Flower nutrients',
        actorName: 'Blake Ortiz',
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        recordedOn: new Date('2026-10-02T00:00:00.000Z'),
        kind: 'irrigation',
        method: 'Hand',
        volumeLiters: 8,
        ec: 1.2,
        ph: 6.1,
        nutrientName: 'Veg media',
        actorName: 'Casey Nguyen',
      },
    ],
  });
  await prisma.ipmRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        recordedOn: new Date('2026-10-01T00:00:00.000Z'),
        target: 'Thrips',
        finding: 'clear',
        response: 'Monitor',
        actorName: 'Blake Ortiz',
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        recordedOn: new Date('2026-10-01T00:00:00.000Z'),
        target: 'Fungus gnats',
        finding: 'present',
        response: 'Release beneficials',
        actorName: 'Casey Nguyen',
      },
    ],
  });
  await prisma.maintenanceRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        recordedOn: new Date('2026-09-30T00:00:00.000Z'),
        assetName: 'Flower 1 dehumidifier',
        kind: 'preventive',
        summary: 'Cleaned the filter and checked the drain.',
        nextDueOn: new Date('2026-10-30T00:00:00.000Z'),
        actorName: 'Blake Ortiz',
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        recordedOn: new Date('2026-09-29T00:00:00.000Z'),
        assetName: 'Veg 1 circulation fan',
        kind: 'repair',
        summary: 'Replaced the worn guard.',
        nextDueOn: new Date('2026-11-01T00:00:00.000Z'),
        actorName: 'Casey Nguyen',
      },
    ],
  });
  await prisma.purchaseRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        vendorName: 'Harbor supply',
        orderedOn: new Date('2026-09-28T00:00:00.000Z'),
        status: 'received',
        description: 'Flower nutrients',
        quantity: 2,
        unitCostCents: 1500,
      },
      {
        siteId: input.hillSiteId,
        vendorName: 'Ridge supply',
        orderedOn: new Date('2026-09-27T00:00:00.000Z'),
        status: 'requested',
        description: 'Veg media',
        quantity: 1,
        unitCostCents: 4200,
      },
    ],
  });
  await prisma.sanitationRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        recordedOn: new Date('2026-10-01T00:00:00.000Z'),
        area: 'Floor and drains',
        method: 'Quaternary',
        outcome: 'done',
        actorName: 'Blake Ortiz',
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        recordedOn: new Date('2026-10-01T00:00:00.000Z'),
        area: 'Benches',
        method: 'Peroxide',
        outcome: 'follow_up',
        actorName: 'Casey Nguyen',
      },
    ],
  });
  await prisma.trainingRecord.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        traineeName: 'Blake Ortiz',
        title: 'Canopy scout',
        sopTitle: 'Canopy scout',
        status: 'completed',
        completedOn: new Date('2026-09-25T00:00:00.000Z'),
        actorName: 'Avery Chen',
      },
      {
        siteId: input.hillSiteId,
        traineeName: 'Casey Nguyen',
        title: 'IPM scout',
        sopTitle: 'IPM scout',
        status: 'assigned',
        actorName: 'Avery Chen',
      },
    ],
  });
  await prisma.roomStay.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        label: 'Cedar Nights flower',
        cultivar: 'Cedar Nights',
        medium: 'coco',
        startsOn: new Date('2026-09-12T00:00:00.000Z'),
        endsOn: new Date('2026-10-24T00:00:00.000Z'),
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        label: 'Glass Orchard veg',
        cultivar: 'Glass Orchard',
        medium: 'soil',
        startsOn: new Date('2026-09-20T00:00:00.000Z'),
        endsOn: new Date('2026-11-15T00:00:00.000Z'),
      },
    ],
  });
  await prisma.recurringDuty.createMany({
    data: [
      {
        siteId: input.harborSiteId,
        roomId: input.flowerRoomId,
        title: 'Check drip lines',
        cadence: 'weekly',
        nextDueOn: new Date('2026-10-04T00:00:00.000Z'),
        assigneeLabel: 'Blake Ortiz',
        sopTitle: 'Irrigation pass',
      },
      {
        siteId: input.hillSiteId,
        roomId: input.vegRoomId,
        title: 'Wipe tables',
        cadence: 'daily',
        nextDueOn: new Date('2026-10-03T00:00:00.000Z'),
        assigneeLabel: 'Casey Nguyen',
        sopTitle: 'Room sanitation',
      },
    ],
  });
}

async function seedCultivarTemplate(input: {
  organizationId: string;
  name: string;
  cultivar: string;
  medium: string;
  roleId: string;
  taskKey: string;
  taskTitle: string;
  sopId: string;
}): Promise<void> {
  const template = await prisma.workflowTemplate.upsert({
    where: { organizationId_name: { organizationId: input.organizationId, name: input.name } },
    create: {
      organizationId: input.organizationId,
      name: input.name,
      cultivar: input.cultivar,
      medium: input.medium,
    },
    update: { cultivar: input.cultivar, medium: input.medium },
  });
  const version = await prisma.workflowTemplateVersion.upsert({
    where: { templateId_versionNumber: { templateId: template.id, versionNumber: 1 } },
    create: {
      templateId: template.id,
      versionNumber: 1,
      durationDays: 28,
      startingEvent: 'cycle_start',
    },
    update: {},
  });
  const existing = await prisma.workflowTaskTemplate.findFirst({
    where: { versionId: version.id, taskKey: input.taskKey },
  });
  if (existing) {
    return;
  }
  await prisma.workflowTaskTemplate.create({
    data: {
      versionId: version.id,
      taskKey: input.taskKey,
      title: input.taskTitle,
      offsetDays: 0,
      sortOrder: 0,
      assigneeType: 'role',
      roleId: input.roleId,
      instructions: input.taskTitle,
      sopRecordId: input.sopId,
      requiresNotes: true,
      checklist: { create: [{ label: 'Record the result', sortOrder: 0 }] },
    },
  });
}

function addUtcDays(value: Date, days: number): Date {
  const [year, month, day] = value.toISOString().slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
