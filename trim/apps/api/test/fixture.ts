import { PrismaClient } from '@trim/database';
import bcrypt from 'bcryptjs';

export interface AccessFixture {
  organizationId: string;
  otherOrganizationId: string;
  siteAId: string;
  siteBId: string;
  otherSiteId: string;
  roomAId: string;
  roomBId: string;
  otherRoomId: string;
  siteAUser: { email: string; password: string };
  siteBUser: { email: string; password: string };
  adminUser: { email: string; password: string };
}

export async function createAccessFixture(prisma: PrismaClient): Promise<AccessFixture> {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'Access-test-pass';
  const passwordHash = await bcrypt.hash(password, 8);

  const organization = await prisma.organization.create({
    data: { name: `Access Org ${stamp}`, slug: `access-org-${stamp}` },
  });
  const otherOrganization = await prisma.organization.create({
    data: { name: `Other Org ${stamp}`, slug: `other-org-${stamp}` },
  });

  const adminRole = await prisma.role.create({
    data: {
      organizationId: organization.id,
      key: 'org_admin',
      name: 'Organization admin',
      description: 'Test org admin',
      isOrgWide: true,
    },
  });
  const operatorRole = await prisma.role.create({
    data: {
      organizationId: organization.id,
      key: 'site_operator',
      name: 'Site operator',
      description: 'Test site operator',
      isOrgWide: false,
    },
  });

  const siteA = await prisma.site.create({
    data: {
      organizationId: organization.id,
      name: 'Site A',
      code: 'SITE-A',
      city: 'Astoria',
      region: 'OR',
      rooms: { create: { name: 'Room A', code: 'RA', roomType: 'flower' } },
    },
    include: { rooms: true },
  });
  const siteB = await prisma.site.create({
    data: {
      organizationId: organization.id,
      name: 'Site B',
      code: 'SITE-B',
      city: 'Hood River',
      region: 'OR',
      rooms: { create: { name: 'Room B', code: 'RB', roomType: 'veg' } },
    },
    include: { rooms: true },
  });
  const otherSite = await prisma.site.create({
    data: {
      organizationId: otherOrganization.id,
      name: 'Other Site',
      code: 'OTHER',
      rooms: { create: { name: 'Other Room', code: 'OR', roomType: 'dry' } },
    },
    include: { rooms: true },
  });

  const siteAUser = await createUser(prisma, {
    organizationId: organization.id,
    email: `site-a-${stamp}@trim.test`,
    name: 'Site A Operator',
    passwordHash,
    roleId: operatorRole.id,
    siteId: siteA.id,
  });
  const siteBUser = await createUser(prisma, {
    organizationId: organization.id,
    email: `site-b-${stamp}@trim.test`,
    name: 'Site B Operator',
    passwordHash,
    roleId: operatorRole.id,
    siteId: siteB.id,
  });
  const adminUser = await createUser(prisma, {
    organizationId: organization.id,
    email: `admin-${stamp}@trim.test`,
    name: 'Org Admin',
    passwordHash,
    roleId: adminRole.id,
  });

  const roomA = siteA.rooms[0];
  const roomB = siteB.rooms[0];
  const otherRoom = otherSite.rooms[0];
  if (!roomA || !roomB || !otherRoom) {
    throw new Error('Fixture rooms were not created');
  }

  return {
    organizationId: organization.id,
    otherOrganizationId: otherOrganization.id,
    siteAId: siteA.id,
    siteBId: siteB.id,
    otherSiteId: otherSite.id,
    roomAId: roomA.id,
    roomBId: roomB.id,
    otherRoomId: otherRoom.id,
    siteAUser: { email: siteAUser.email, password },
    siteBUser: { email: siteBUser.email, password },
    adminUser: { email: adminUser.email, password },
  };
}

async function createUser(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    email: string;
    name: string;
    passwordHash: string;
    roleId: string;
    siteId?: string;
  },
) {
  return prisma.user.create({
    data: {
      organizationId: input.organizationId,
      email: input.email,
      name: input.name,
      credential: { create: { passwordHash: input.passwordHash } },
      userRoles: { create: { roleId: input.roleId } },
      memberships: input.siteId ? { create: { siteId: input.siteId } } : undefined,
    },
  });
}
