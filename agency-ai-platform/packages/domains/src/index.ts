/** Domains package — registration and DNS adapters. */
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
