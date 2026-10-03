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
  { key: 'organization.read', description: 'View the organization profile' },
  { key: 'sites.read', description: 'View facilities the user is allowed to open' },
  { key: 'rooms.read', description: 'View rooms inside an authorized facility' },
  { key: 'zones.read', description: 'View zones inside an authorized room' },
];

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

  for (const roleId of [orgAdmin.id, siteOperator.id]) {
    for (const permissionId of permissions.values()) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        create: { roleId, permissionId },
        update: {},
      });
    }
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

  await upsertActiveCycle(flower.id, {
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

  await upsertActiveCycle(veg.id, {
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

  const license = await prisma.license.upsert({
    where: {
      organizationId_licenseNumber: {
        organizationId: organization.id,
        licenseNumber: 'OR-CULT-44821',
      },
    },
    create: {
      organizationId: organization.id,
      licenseNumber: 'OR-CULT-44821',
      licenseType: 'producer',
      jurisdiction: 'US-OR',
      status: 'active',
      issuedOn: new Date('2024-03-01'),
      expiresOn: new Date('2027-03-01'),
    },
    update: {
      licenseType: 'producer',
      jurisdiction: 'US-OR',
      status: 'active',
    },
  });

  for (const siteId of [harbor.id, hill.id]) {
    await prisma.licenseSite.upsert({
      where: { licenseId_siteId: { licenseId: license.id, siteId } },
      create: { licenseId: license.id, siteId },
      update: {},
    });
  }

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
): Promise<void> {
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
