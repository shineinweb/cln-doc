import { describe, expect, it } from "vitest";
import {
  describeHostingStatus,
  type CreateHostingAccountInput,
  type HostingAccount,
  type HostingProvider,
  type HostingUsage,
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
