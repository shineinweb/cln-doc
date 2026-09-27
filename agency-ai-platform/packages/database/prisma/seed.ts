import { PrismaClient, type OrganizationMemberRole } from "@prisma/client";
import {
  hashPassword,
  PLATFORM_PERMISSION_KEYS,
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
} from "@agency/auth";

const prisma = new PrismaClient();

/** Legacy role keys replaced by the platform catalog. */
const DEPRECATED_ROLE_KEYS = ["admin", "support"] as const;

async function main() {
  for (const permission of PLATFORM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { description: permission.description },
    });
  }

  // Super Admin uses literal "*" grant (not part of the enumerated catalog).
  await prisma.permission.upsert({
    where: { key: "*" },
    create: { key: "*", description: "Unrestricted access (super admin)" },
    update: { description: "Unrestricted access (super admin)" },
  });

  const retainedPermissionKeys = [...PLATFORM_PERMISSION_KEYS, "*"];

  // Drop obsolete permission keys no longer in the catalog.
  await prisma.rolePermission.deleteMany({
    where: { permission: { key: { notIn: retainedPermissionKeys } } },
  });
  await prisma.permission.deleteMany({
    where: { key: { notIn: retainedPermissionKeys } },
  });

  const roleIds = new Map<string, string>();

  for (const role of PLATFORM_ROLES) {
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

    const desiredPermissionIds: string[] = [];
    for (const permissionKey of role.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      desiredPermissionIds.push(permission.id);
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

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: savedRole.id,
        permissionId: { notIn: desiredPermissionIds },
      },
    });
  }

  await prisma.userRole.deleteMany({
    where: { role: { key: { in: [...DEPRECATED_ROLE_KEYS] } } },
  });
  await prisma.role.deleteMany({
    where: { key: { in: [...DEPRECATED_ROLE_KEYS] } },
  });

  const passwordHash = await hashPassword("ChangeMeLocalOnly!");

  const staffUser = await prisma.user.upsert({
    where: { email: "admin@agency.local" },
    create: {
      email: "admin@agency.local",
      name: "Agency Super Admin",
      passwordHash,
      isStaff: true,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      name: "Agency Super Admin",
      passwordHash,
      isStaff: true,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  const superAdminRoleId = roleIds.get("super_admin");
  if (superAdminRoleId) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: staffUser.id,
          roleId: superAdminRoleId,
        },
      },
      create: {
        userId: staffUser.id,
        roleId: superAdminRoleId,
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

  const customerRoleId = roleIds.get("customer");
  if (customerRoleId) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: customerUser.id,
          roleId: customerRoleId,
        },
      },
      create: {
        userId: customerUser.id,
        roleId: customerRoleId,
      },
      update: {},
    });
  }

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
        seededRoles: PLATFORM_ROLES.map((role) => role.key),
      },
    },
  });

  console.log("Seed complete:", {
    staff: staffUser.email,
    staffRole: "super_admin",
    customerOwner: customerUser.email,
    organization: organization.slug,
    roles: PLATFORM_ROLES.map((role) => role.key),
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
