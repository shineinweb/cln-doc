import { PrismaClient, type OrganizationMemberRole } from "@prisma/client";
import { hashPassword } from "@agency/auth";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "audit.read", description: "Read audit logs" },
  { key: "crm.customers.read", description: "View customers" },
  { key: "crm.customers.write", description: "Create/update customers" },
  { key: "settings.write", description: "Change system settings" },
  { key: "roles.read", description: "View roles and permissions" },
  { key: "roles.write", description: "Manage roles and permissions" },
] as const;

const ROLES: Array<{
  key: string;
  name: string;
  description: string;
  permissions: readonly string[];
}> = [
  {
    key: "admin",
    name: "Administrator",
    description: "Full staff access for local development",
    permissions: PERMISSIONS.map((permission) => permission.key),
  },
  {
    key: "support",
    name: "Support",
    description: "Customer support staff",
    permissions: ["audit.read", "crm.customers.read"],
  },
];

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }

  const roleIds = new Map<string, string>();

  for (const role of ROLES) {
    const savedRole = await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        name: role.name,
        description: role.description,
      },
      update: {
        name: role.name,
        description: role.description,
      },
    });
    roleIds.set(role.key, savedRole.id);

    for (const permissionKey of role.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: savedRole.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: savedRole.id,
          permissionId: permission.id,
        },
        update: {},
      });
    }
  }

  const passwordHash = await hashPassword("ChangeMeLocalOnly!");

  const staffUser = await prisma.user.upsert({
    where: { email: "admin@agency.local" },
    create: {
      email: "admin@agency.local",
      name: "Agency Admin",
      passwordHash,
      isStaff: true,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      name: "Agency Admin",
      passwordHash,
      isStaff: true,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const adminRoleId = roleIds.get("admin");
  if (adminRoleId) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: staffUser.id,
          roleId: adminRoleId,
        },
      },
      create: {
        userId: staffUser.id,
        roleId: adminRoleId,
      },
      update: {},
    });
  }

  const customerUser = await prisma.user.upsert({
    where: { email: "owner@acme.local" },
    create: {
      email: "owner@acme.local",
      name: "Acme Owner",
      passwordHash,
      isStaff: false,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      name: "Acme Owner",
      passwordHash,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "acme" },
    create: {
      name: "Acme Corporation",
      slug: "acme",
    },
    update: {
      name: "Acme Corporation",
    },
  });

  const memberRole: OrganizationMemberRole = "OWNER";
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: customerUser.id,
      },
    },
    create: {
      organizationId: organization.id,
      userId: customerUser.id,
      role: memberRole,
    },
    update: {
      role: memberRole,
    },
  });

  const customer = await prisma.customer.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      displayName: "Acme Corporation",
      legalName: "Acme Corporation LLC",
      status: "active",
    },
    update: {
      displayName: "Acme Corporation",
      legalName: "Acme Corporation LLC",
      status: "active",
    },
  });

  const existingPrimary = await prisma.customerContact.findFirst({
    where: { customerId: customer.id, isPrimary: true },
  });

  if (existingPrimary) {
    await prisma.customerContact.update({
      where: { id: existingPrimary.id },
      data: {
        userId: customerUser.id,
        name: "Acme Owner",
        email: "owner@acme.local",
        title: "Owner",
        isPrimary: true,
      },
    });
  } else {
    await prisma.customerContact.create({
      data: {
        customerId: customer.id,
        userId: customerUser.id,
        name: "Acme Owner",
        email: "owner@acme.local",
        title: "Owner",
        isPrimary: true,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: staffUser.id,
      actorType: "staff",
      organizationId: organization.id,
      action: "seed.completed",
      entityType: "Organization",
      entityId: organization.id,
      afterJson: {
        slug: organization.slug,
        seededRoles: ROLES.map((role) => role.key),
      },
    },
  });

  console.log("Seed complete:", {
    staff: staffUser.email,
    customerOwner: customerUser.email,
    organization: organization.slug,
    roles: ROLES.map((role) => role.key),
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
