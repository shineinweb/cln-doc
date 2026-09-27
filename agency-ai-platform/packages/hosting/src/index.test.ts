import { describe, expect, it, vi } from "vitest";
import {
  CPANEL_WHM_PROVIDER_NAME,
  CpanelWhmProvider,
  HostingProviderUnwiredError,
  UnwiredWhmApiTransport,
  describeHostingStatus,
  normalizeWhmUsername,
  usernameFromDomain,
  type CreateHostingAccountInput,
  type HostingAccount,
  type HostingProvider,
  type HostingUsage,
  type WhmApiTransport,
} from "./index";

describe("hosting status helpers", () => {
  it("describes known statuses", () => {
    expect(describeHostingStatus("live")).toBe("Live");
    expect(describeHostingStatus("provisioning")).toBe("Provisioning");
  });
});

describe("HostingProvider contract", () => {
  it("exposes HostingProvider as a structural contract", async () => {
    const accounts = new Map<string, HostingAccount>();

    const provider: HostingProvider = {
      name: "noop",
      createAccount: async (input: CreateHostingAccountInput) => {
        const account: HostingAccount = {
          id: "ha_local_1",
          provider: "noop",
          externalId: "cpanel_noop_1",
          organizationId: input.organizationId,
          domain: input.domain,
          username: input.username ?? "noopuser",
          packageKey: input.packageKey,
          status: "ACTIVE",
          serverId: input.serverId,
        };
        accounts.set(account.id, account);
        return account;
      },
      suspendAccount: async (id) => {
        const account = accounts.get(id);
        if (account) account.status = "SUSPENDED";
      },
      unsuspendAccount: async (id) => {
        const account = accounts.get(id);
        if (account) account.status = "ACTIVE";
      },
      terminateAccount: async (id) => {
        const account = accounts.get(id);
        if (account) account.status = "TERMINATED";
      },
      getUsage: async (id): Promise<HostingUsage> => ({
        accountId: id,
        diskUsedBytes: 0,
        diskLimitBytes: null,
        bandwidthUsedBytes: 0,
        bandwidthLimitBytes: null,
        measuredAt: new Date(0).toISOString(),
      }),
    };

    const created = await provider.createAccount({
      organizationId: "org_1",
      domain: "example.test",
      packageKey: "starter",
    });
    expect(provider.name).toBe("noop");
    expect(created.status).toBe("ACTIVE");

    await provider.suspendAccount(created.id);
    expect(accounts.get(created.id)?.status).toBe("SUSPENDED");

    await provider.unsuspendAccount(created.id);
    expect(accounts.get(created.id)?.status).toBe("ACTIVE");

    const usage = await provider.getUsage(created.id);
    expect(usage.accountId).toBe(created.id);

    await provider.terminateAccount(created.id);
    expect(accounts.get(created.id)?.status).toBe("TERMINATED");
  });
});

describe("CpanelWhmProvider", () => {
  const config = {
    baseUrl: "https://whm.example.test:2087",
    apiToken: "test-token",
    whmUser: "root",
    defaultServerId: "srv_1",
  };

  it("normalizes WHM usernames", () => {
    expect(normalizeWhmUsername("Acme-Web!")).toBe("acmeweb");
    expect(normalizeWhmUsername("123site")).toBe("u123site");
    expect(usernameFromDomain("MyBrand.co.uk")).toBe("mybrand");
  });

  it("rejects missing config", () => {
    expect(() => new CpanelWhmProvider({ baseUrl: "", apiToken: "x" })).toThrow(/baseUrl/);
    expect(() => new CpanelWhmProvider({ baseUrl: "https://x", apiToken: "" })).toThrow(
      /apiToken/,
    );
  });

  it("fails loudly when WHM transport is unwired", async () => {
    const provider = new CpanelWhmProvider(config, new UnwiredWhmApiTransport());
    expect(provider.name).toBe(CPANEL_WHM_PROVIDER_NAME);
    await expect(
      provider.createAccount({
        organizationId: "org_1",
        domain: "example.test",
        packageKey: "starter",
      }),
    ).rejects.toBeInstanceOf(HostingProviderUnwiredError);
  });

  it("maps domain DTOs through an injected WhmApiTransport", async () => {
    const transport: WhmApiTransport = {
      createAccount: vi.fn(async (params) => ({
        externalId: `user_${params.username}`,
        username: params.username,
        domain: params.domain,
      })),
      suspendAccount: vi.fn(async () => undefined),
      unsuspendAccount: vi.fn(async () => undefined),
      terminateAccount: vi.fn(async () => undefined),
      getUsage: vi.fn(async () => ({
        diskUsedBytes: 1024,
        diskLimitBytes: 10_485_760,
        bandwidthUsedBytes: 2048,
        bandwidthLimitBytes: null,
      })),
    };

    const provider = new CpanelWhmProvider(config, transport);
    const created = await provider.createAccount({
      organizationId: "org_1",
      domain: "Example.Test",
      packageKey: "starter",
      contactEmail: "ops@example.test",
    });

    expect(created).toMatchObject({
      id: "ha_user_example",
      provider: CPANEL_WHM_PROVIDER_NAME,
      externalId: "user_example",
      username: "example",
      domain: "example.test",
      status: "ACTIVE",
      serverId: "srv_1",
    });
    expect(transport.createAccount).toHaveBeenCalledWith({
      domain: "example.test",
      username: "example",
      plan: "starter",
      contactEmail: "ops@example.test",
    });

    await provider.suspendAccount(created.id);
    expect(transport.suspendAccount).toHaveBeenCalledWith("user_example");

    await provider.unsuspendAccount(created.id);
    expect(transport.unsuspendAccount).toHaveBeenCalledWith("user_example");

    const usage = await provider.getUsage(created.id);
    expect(usage.diskUsedBytes).toBe(1024);
    expect(usage.accountId).toBe(created.id);

    await provider.terminateAccount(created.externalId);
    expect(transport.terminateAccount).toHaveBeenCalledWith("user_example");
  });
});
