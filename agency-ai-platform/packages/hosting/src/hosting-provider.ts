/**
 * HostingProvider — WHM/cPanel (and future adapters) implement this interface.
 * Nest controllers and React apps must not call vendor SDKs directly.
 *
 * PLACEHOLDER: no live WHM/cPanel adapter yet. Wire a real adapter behind this
 * contract in Phase 6; do not invent fake remote APIs in apps.
 */

export type HostingAccountStatus =
  | "PROVISIONING"
  | "ACTIVE"
  | "SUSPENDED"
  | "TERMINATED"
  | "FAILED";

export type HostingProviderRef = {
  provider: string;
  externalId: string;
};

export type CreateHostingAccountInput = {
  organizationId: string;
  /** Primary domain for the account (e.g. example.com). */
  domain: string;
  /** Local / remote package key the adapter maps to a WHM package. */
  packageKey: string;
  /** Optional preferred cPanel username; adapter may normalize or allocate. */
  username?: string;
  /** Optional inventory Server id when multi-server routing is enabled. */
  serverId?: string;
  contactEmail?: string;
};

export type HostingAccount = HostingProviderRef & {
  id: string;
  organizationId: string;
  domain: string;
  username: string;
  packageKey: string;
  status: HostingAccountStatus;
  serverId?: string;
};

export type HostingUsage = {
  accountId: string;
  /** Disk used in bytes. */
  diskUsedBytes: number;
  /** Disk limit in bytes; null = unlimited / unknown. */
  diskLimitBytes: number | null;
  /** Bandwidth used in bytes for the current period. */
  bandwidthUsedBytes: number;
  /** Bandwidth limit in bytes; null = unlimited / unknown. */
  bandwidthLimitBytes: number | null;
  measuredAt: string;
};

export interface HostingProvider {
  readonly name: string;
  createAccount(input: CreateHostingAccountInput): Promise<HostingAccount>;
  suspendAccount(id: string): Promise<void>;
  unsuspendAccount(id: string): Promise<void>;
  terminateAccount(id: string): Promise<void>;
  getUsage(id: string): Promise<HostingUsage>;
}
