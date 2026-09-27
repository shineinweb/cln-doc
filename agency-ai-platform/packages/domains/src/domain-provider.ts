/**
 * DomainProvider — registrar adapters implement this interface.
 * Nest controllers and React apps must not call vendor SDKs directly.
 *
 * Covers registration lifecycle + nameservers + DNS record CRUD.
 * PLACEHOLDER: no live registrar SDK wired yet — do not invent fake remote
 * APIs in apps; bind a sandbox/production adapter behind this contract.
 */

export type DomainMoney = {
  amountCents: number;
  currency: string;
};

export type DomainOrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type DomainDnsRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "TXT"
  | "NS"
  | "SRV"
  | "CAA";

export type SearchDomainInput = {
  /** FQDN or label to check (e.g. example.com or example). */
  query: string;
  /** Optional TLD filter when query has no TLD. */
  tlds?: string[];
};

export type DomainSearchResult = {
  domain: string;
  available: boolean;
  premium?: boolean;
  /** Registration price for the quoted term when available. */
  price?: DomainMoney & { years: number };
};

export type RegisterDomainInput = {
  organizationId: string;
  domain: string;
  years: number;
  nameservers?: string[];
  contactEmail?: string;
};

export type TransferDomainInput = {
  organizationId: string;
  domain: string;
  authCode: string;
  years?: number;
};

export type RenewDomainInput = {
  domain: string;
  years: number;
};

export type DomainOrderResult = {
  id: string;
  provider: string;
  externalId: string;
  domain: string;
  status: DomainOrderStatus;
  expiresAt?: string;
};

export type DomainDnsRecord = {
  id: string;
  type: DomainDnsRecordType;
  name: string;
  value: string;
  ttl: number;
  /** MX / SRV priority when applicable. */
  priority?: number;
};

export type CreateDnsRecordInput = {
  domain: string;
  type: DomainDnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
};

export type UpdateDnsRecordInput = {
  domain: string;
  recordId: string;
  name?: string;
  value?: string;
  ttl?: number;
  priority?: number;
};

export interface DomainProvider {
  readonly name: string;

  searchDomain(input: SearchDomainInput): Promise<DomainSearchResult[]>;
  registerDomain(input: RegisterDomainInput): Promise<DomainOrderResult>;
  transferDomain(input: TransferDomainInput): Promise<DomainOrderResult>;
  renewDomain(input: RenewDomainInput): Promise<DomainOrderResult>;

  getNameservers(domain: string): Promise<string[]>;
  setNameservers(domain: string, nameservers: string[]): Promise<void>;

  getDNSRecords(domain: string): Promise<DomainDnsRecord[]>;
  createDNSRecord(input: CreateDnsRecordInput): Promise<DomainDnsRecord>;
  updateDNSRecord(input: UpdateDnsRecordInput): Promise<DomainDnsRecord>;
  deleteDNSRecord(domain: string, recordId: string): Promise<void>;
}

/**
 * DNS-only surface of DomainProvider (for DI tokens that only need zone CRUD).
 * Prefer DomainProvider when registration + DNS share one registrar adapter.
 */
export type DnsProvider = Pick<
  DomainProvider,
  "name" | "getDNSRecords" | "createDNSRecord" | "updateDNSRecord" | "deleteDNSRecord"
>;
