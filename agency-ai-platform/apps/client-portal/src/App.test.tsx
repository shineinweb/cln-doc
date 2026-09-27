import { describe, expect, it } from "vitest";
import { formatUsagePair } from "@agency/hosting";
import {
  PLACEHOLDER_HOSTING_ACCOUNTS,
  PLACEHOLDER_NEW_TICKET,
  PORTAL_NAV,
} from "./data/placeholders";

describe("client portal hosting placeholders", () => {
  it("exposes hosting nav and example.com Business Hosting card data", () => {
    expect(PORTAL_NAV.map((item) => item.to)).toContain("/hosting");
    const account = PLACEHOLDER_HOSTING_ACCOUNTS[0];
    expect(account?.domain).toBe("example.com");
    expect(account?.packageName).toBe("Business Hosting");
    expect(account?.statusLabel).toBe("Active");
    expect(
      formatUsagePair(account!.diskUsedBytes, account!.diskLimitBytes),
    ).toBe("14 GB / 50 GB");
    expect(
      formatUsagePair(account!.bandwidthUsedBytes, account!.bandwidthLimitBytes),
    ).toBe("34 GB / 500 GB");
  });
});

describe("client portal new ticket form", () => {
  it("exposes tickets nav and New Ticket demo prefill", () => {
    expect(PORTAL_NAV.map((item) => item.to)).toContain("/tickets");
    expect(PLACEHOLDER_NEW_TICKET.department).toBe("hosting");
    expect(PLACEHOLDER_NEW_TICKET.priority).toBe("HIGH");
    expect(PLACEHOLDER_NEW_TICKET.subject).toBe("Website unavailable");
    expect(PLACEHOLDER_NEW_TICKET.message.length).toBeGreaterThan(0);
  });
});
