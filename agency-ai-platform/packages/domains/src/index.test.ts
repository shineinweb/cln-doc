import { describe, expect, it } from "vitest";
import {
  normalizeDomain,
  type CreateDnsRecordInput,
  type DomainDnsRecord,
  type DomainProvider,
  type DomainSearchResult,
} from "./index";

describe("normalizeDomain", () => {
  it("lowercases and strips trailing dot", () => {
    expect(normalizeDomain(" Example.COM. ")).toBe("example.com");
  });
});

describe("DomainProvider contract", () => {
  it("exposes DomainProvider as a structural contract", async () => {
    const records = new Map<string, DomainDnsRecord>();
    let nameservers = ["ns1.example.test", "ns2.example.test"];

    const provider: DomainProvider = {
      name: "noop",
      searchDomain: async (input): Promise<DomainSearchResult[]> => [
        {
          domain: normalizeDomain(input.query.includes(".") ? input.query : `${input.query}.com`),
          available: true,
          price: { amountCents: 1299, currency: "USD", years: 1 },
        },
      ],
      registerDomain: async (input) => ({
        id: "ord_1",
        provider: "noop",
        externalId: "ext_ord_1",
        domain: normalizeDomain(input.domain),
        status: "COMPLETED",
        expiresAt: new Date(0).toISOString(),
      }),
      transferDomain: async (input) => ({
        id: "ord_xfer_1",
        provider: "noop",
        externalId: "ext_xfer_1",
        domain: normalizeDomain(input.domain),
        status: "PENDING",
      }),
      renewDomain: async (input) => ({
        id: "ord_renew_1",
        provider: "noop",
        externalId: "ext_renew_1",
        domain: normalizeDomain(input.domain),
        status: "COMPLETED",
      }),
      getNameservers: async () => [...nameservers],
      setNameservers: async (_domain, next) => {
        nameservers = [...next];
      },
      getDNSRecords: async () => [...records.values()],
      createDNSRecord: async (input: CreateDnsRecordInput) => {
        const record: DomainDnsRecord = {
          id: `rec_${records.size + 1}`,
          type: input.type,
          name: input.name,
          value: input.value,
          ttl: input.ttl ?? 3600,
          priority: input.priority,
        };
        records.set(record.id, record);
        return record;
      },
      updateDNSRecord: async (input) => {
        const existing = records.get(input.recordId);
        if (!existing) throw new Error("missing record");
        const updated: DomainDnsRecord = {
          ...existing,
          name: input.name ?? existing.name,
          value: input.value ?? existing.value,
          ttl: input.ttl ?? existing.ttl,
          priority: input.priority ?? existing.priority,
        };
        records.set(updated.id, updated);
        return updated;
      },
      deleteDNSRecord: async (_domain, recordId) => {
        records.delete(recordId);
      },
    };

    const search = await provider.searchDomain({ query: "Example.COM" });
    expect(provider.name).toBe("noop");
    expect(search[0]?.available).toBe(true);

    const registered = await provider.registerDomain({
      organizationId: "org_1",
      domain: "Example.COM",
      years: 1,
    });
    expect(registered.status).toBe("COMPLETED");

    await provider.setNameservers("example.com", ["ns1.agency.test", "ns2.agency.test"]);
    expect(await provider.getNameservers("example.com")).toEqual([
      "ns1.agency.test",
      "ns2.agency.test",
    ]);

    const created = await provider.createDNSRecord({
      domain: "example.com",
      type: "A",
      name: "@",
      value: "203.0.113.10",
    });
    expect(created.type).toBe("A");

    const updated = await provider.updateDNSRecord({
      domain: "example.com",
      recordId: created.id,
      value: "203.0.113.11",
    });
    expect(updated.value).toBe("203.0.113.11");

    expect((await provider.getDNSRecords("example.com")).length).toBe(1);
    await provider.deleteDNSRecord("example.com", created.id);
    expect(await provider.getDNSRecords("example.com")).toEqual([]);

    const transfer = await provider.transferDomain({
      organizationId: "org_1",
      domain: "move.example",
      authCode: "AUTH",
    });
    expect(transfer.status).toBe("PENDING");

    const renewed = await provider.renewDomain({ domain: "example.com", years: 1 });
    expect(renewed.status).toBe("COMPLETED");
  });
});
