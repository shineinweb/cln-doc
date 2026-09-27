import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { hashPassword, InMemoryEmailProvider } from "@agency/auth";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "./auth.service";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organization: { create: vi.fn() },
    organizationMember: { create: vi.fn() },
    customer: { create: vi.fn() },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    authToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { prismaMock };
});

vi.mock("@agency/database", () => ({
  prisma: prismaMock,
}));

describe("AuthService", () => {
  const email = new InMemoryEmailProvider();
  const audit = {
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    email.sent.length = 0;
    service = new AuthService(audit, email);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
      fn(prismaMock),
    );
  });

  it("registers a customer, creates session, and sends verification email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      isStaff: false,
    });
    prismaMock.organization.create.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme-abc",
    });
    prismaMock.organizationMember.create.mockResolvedValue({});
    prismaMock.customer.create.mockResolvedValue({});
    prismaMock.session.create.mockResolvedValue({ id: "sess-1" });
    prismaMock.authToken.create.mockResolvedValue({});
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      isStaff: false,
      emailVerifiedAt: null,
      organizationMembers: [
        {
          organizationId: "org-1",
          role: "OWNER",
          organization: { name: "Acme", slug: "acme-abc" },
        },
      ],
      userRoles: [],
    });

    const result = await service.register(
      {
        email: "Owner@Example.com",
        password: "Correct-Horse-1",
        name: "Owner",
        organizationName: "Acme",
      },
      { ip: "127.0.0.1", userAgent: "vitest" },
    );

    expect(result.sessionToken.length).toBeGreaterThan(20);
    expect(result.user.email).toBe("owner@example.com");
    expect(result.user.permissions).toContain("ai.use");
    expect(result.user.roles).toContain("customer");
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]?.subject).toMatch(/Verify/i);
    expect(audit.write).toHaveBeenCalled();
  });

  it("rejects duplicate registration", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "existing" });
    await expect(
      service.register(
        {
          email: "owner@example.com",
          password: "Correct-Horse-1",
          name: "Owner",
          organizationName: "Acme",
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects invalid login credentials", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expect(
      service.login({ email: "missing@example.com", password: "Correct-Horse-1" }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("logs in with valid credentials", async () => {
    const passwordHash = await hashPassword("Correct-Horse-1");
    prismaMock.user.findFirst.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      passwordHash,
      isActive: true,
      isStaff: false,
      deletedAt: null,
    });
    prismaMock.session.create.mockResolvedValue({ id: "sess-1" });
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      isStaff: false,
      emailVerifiedAt: new Date(),
      organizationMembers: [],
      userRoles: [],
    });

    const result = await service.login(
      { email: "owner@example.com", password: "Correct-Horse-1" },
      { ip: "127.0.0.1" },
    );

    expect(result.user.id).toBe("user-1");
    expect(result.sessionToken).toBeTruthy();
  });
});
