/**
 * CpanelWhmProvider — WHM/cPanel adapter for HostingProvider.
 *
 * PLACEHOLDER: no live WHM HTTP client is shipped here. Nest (or tests) must
 * inject a WhmApiTransport. Do not call WHM from apps/controllers directly.
 */

import type {
  CreateHostingAccountInput,
  HostingAccount,
  HostingProvider,
  HostingUsage,
} from "./hosting-provider";

export const CPANEL_WHM_PROVIDER_NAME = "cpanel-whm" as const;

export type CpanelWhmConfig = {
  /** WHM base URL, e.g. https://whm.example.com:2087 */
  baseUrl: string;
  /** WHM API token (Authorization: whm username:token). */
  apiToken: string;
  /** WHM auth user (usually root or a reseller). */
  whmUser?: string;
  /** Optional default server inventory id stamped on created accounts. */
  defaultServerId?: string;
};

/** Vendor-shaped WHM call surface — keep Nest/React free of WHM SDKs. */
export type WhmCreateAccountParams = {
  domain: string;
  username: string;
  plan: string;
  contactEmail?: string;
};

export type WhmCreateAccountResult = {
  externalId: string;
  username: string;
  domain: string;
};

export type WhmUsageResult = {
  diskUsedBytes: number;
  diskLimitBytes: number | null;
  bandwidthUsedBytes: number;
  bandwidthLimitBytes: number | null;
};

export interface WhmApiTransport {
  createAccount(params: WhmCreateAccountParams): Promise<WhmCreateAccountResult>;
  suspendAccount(externalId: string): Promise<void>;
  unsuspendAccount(externalId: string): Promise<void>;
  terminateAccount(externalId: string): Promise<void>;
  getUsage(externalId: string): Promise<WhmUsageResult>;
}

export class HostingProviderUnwiredError extends Error {
  constructor(operation: string) {
    super(
      `CpanelWhmProvider.${operation}: WHM API transport is not wired. ` +
        "Inject a WhmApiTransport (sandbox or production) — do not invent fake remote APIs in apps.",
    );
    this.name = "HostingProviderUnwiredError";
  }
}

/** Default transport — fails loudly until a real WHM client is bound. */
export class UnwiredWhmApiTransport implements WhmApiTransport {
  createAccount(): Promise<WhmCreateAccountResult> {
    return Promise.reject(new HostingProviderUnwiredError("createAccount"));
  }
  suspendAccount(): Promise<void> {
    return Promise.reject(new HostingProviderUnwiredError("suspendAccount"));
  }
  unsuspendAccount(): Promise<void> {
    return Promise.reject(new HostingProviderUnwiredError("unsuspendAccount"));
  }
  terminateAccount(): Promise<void> {
    return Promise.reject(new HostingProviderUnwiredError("terminateAccount"));
  }
  getUsage(): Promise<WhmUsageResult> {
    return Promise.reject(new HostingProviderUnwiredError("getUsage"));
  }
}

/** WHM usernames: lowercase alphanumeric, max 16 (common cPanel limit). */
export function normalizeWhmUsername(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  if (!cleaned) {
    throw new Error("CpanelWhmProvider: username must contain alphanumeric characters");
  }
  if (/^[0-9]/.test(cleaned)) {
    return `u${cleaned}`.slice(0, 16);
  }
  return cleaned;
}

export function usernameFromDomain(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return normalizeWhmUsername(label);
}

export class CpanelWhmProvider implements HostingProvider {
  readonly name = CPANEL_WHM_PROVIDER_NAME;

  constructor(
    private readonly config: CpanelWhmConfig,
    private readonly transport: WhmApiTransport = new UnwiredWhmApiTransport(),
  ) {
    if (!config.baseUrl.trim()) {
      throw new Error("CpanelWhmProvider: baseUrl is required");
    }
    if (!config.apiToken.trim()) {
      throw new Error("CpanelWhmProvider: apiToken is required");
    }
  }

  async createAccount(input: CreateHostingAccountInput): Promise<HostingAccount> {
    const username = input.username
      ? normalizeWhmUsername(input.username)
      : usernameFromDomain(input.domain);

    const remote = await this.transport.createAccount({
      domain: input.domain.toLowerCase(),
      username,
      plan: input.packageKey,
      contactEmail: input.contactEmail,
    });

    return {
      id: `ha_${remote.externalId}`,
      provider: this.name,
      externalId: remote.externalId,
      organizationId: input.organizationId,
      domain: remote.domain,
      username: remote.username,
      packageKey: input.packageKey,
      status: "ACTIVE",
      serverId: input.serverId ?? this.config.defaultServerId,
    };
  }

  async suspendAccount(id: string): Promise<void> {
    await this.transport.suspendAccount(toExternalId(id));
  }

  async unsuspendAccount(id: string): Promise<void> {
    await this.transport.unsuspendAccount(toExternalId(id));
  }

  async terminateAccount(id: string): Promise<void> {
    await this.transport.terminateAccount(toExternalId(id));
  }

  async getUsage(id: string): Promise<HostingUsage> {
    const externalId = toExternalId(id);
    const usage = await this.transport.getUsage(externalId);
    return {
      accountId: id,
      diskUsedBytes: usage.diskUsedBytes,
      diskLimitBytes: usage.diskLimitBytes,
      bandwidthUsedBytes: usage.bandwidthUsedBytes,
      bandwidthLimitBytes: usage.bandwidthLimitBytes,
      measuredAt: new Date().toISOString(),
    };
  }
}

/** Accept domain id (`ha_…`) or raw WHM external id. */
function toExternalId(id: string): string {
  return id.startsWith("ha_") ? id.slice(3) : id;
}
