import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function assigneeForSite(
  prisma: PrismaService,
  organizationId: string,
  siteId: string,
  assigneeId: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!assigneeId) {
    return null;
  }
  const person = await prisma.user.findFirst({
    where: { id: assigneeId, organizationId },
    include: { memberships: true, userRoles: { include: { role: true } } },
  });
  if (!person) {
    throw new BadRequestException('That person is not in this organization.');
  }
  const opensEveryFacility = person.userRoles.some((assignment) => assignment.role.isOrgWide);
  const opensThisFacility = person.memberships.some((membership) => membership.siteId === siteId);
  if (!opensEveryFacility && !opensThisFacility) {
    throw new BadRequestException('That person cannot open this facility.');
  }
  return { id: person.id, name: person.name };
}

export async function assigneesForSite(
  prisma: PrismaService,
  organizationId: string,
  siteId: string,
  assigneeIds: string[] | null | undefined,
): Promise<{ id: string; name: string }[]> {
  const ids = [...new Set((assigneeIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const people = [];
  for (const id of ids) {
    const person = await assigneeForSite(prisma, organizationId, siteId, id);
    if (person) {
      people.push(person);
    }
  }
  return people.sort((left, right) => left.name.localeCompare(right.name));
}
