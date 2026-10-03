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

  await upsertRoom(harbor.id, 'FL1', 'Flower 1', 'flower', [
    ['EAST', 'East canopy'],
    ['WEST', 'West canopy'],
  ]);
  await upsertRoom(harbor.id, 'DRY', 'Dry Room', 'dry', [['HANG', 'Hang bay']]);
  await upsertRoom(hill.id, 'VG1', 'Veg 1', 'veg', [
    ['NORTH', 'North tables'],
    ['SOUTH', 'South tables'],
  ]);
  await upsertRoom(hill.id, 'MOM', 'Mother Room', 'mother', [['STOCK', 'Stock bench']]);

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
): Promise<void> {
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
