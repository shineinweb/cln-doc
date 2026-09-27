/** Domains package — registration, DNS helpers, DomainProvider contract. */
export type DomainRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT";

export type DnsRecord = {
  type: DomainRecordType;
  name: string;
  value: string;
  ttl: number;
};

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

export type {
  CreateDnsRecordInput,
  DnsProvider,
  DomainDnsRecord,
  DomainDnsRecordType,
  DomainMoney,
  DomainOrderResult,
  DomainOrderStatus,
  DomainProvider,
  DomainSearchResult,
  RegisterDomainInput,
  RenewDomainInput,
  SearchDomainInput,
  TransferDomainInput,
  UpdateDnsRecordInput,
} from "./domain-provider";
