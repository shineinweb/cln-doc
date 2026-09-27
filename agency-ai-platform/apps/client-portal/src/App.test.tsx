import { describe, expect, it } from "vitest";
import { formatUsagePair } from "@agency/hosting";
import {
  PLACEHOLDER_DASHBOARD,
  PLACEHOLDER_HOSTING_ACCOUNTS,
  PLACEHOLDER_NEW_TICKET,
  PORTAL_NAV,
} from "./data/placeholders";

describe("client portal home dashboard", () => {
  it("exposes welcome dashboard stats, project, services, and AI entry", () => {
    expect(PORTAL_NAV.map((item) => item.to)).toContain("/ai");
    expect(PLACEHOLDER_DASHBOARD.stats.map((s) => s.label)).toEqual([
      "Websites",
      "Domains",
      "Hosting",
      "Open Tickets",
    ]);
    expect(PLACEHOLDER_DASHBOARD.stats.map((s) => s.value)).toEqual([3, 8, 3, 1]);
    expect(PLACEHOLDER_DASHBOARD.projects[0]?.name).toBe("Company Website");
    expect(PLACEHOLDER_DASHBOARD.projects[0]?.progressPercent).toBe(72);
    expect(PLACEHOLDER_DASHBOARD.services[0]?.name).toBe("example.com");
    expect(PLACEHOLDER_DASHBOARD.invoice.amountLabel).toBe("$248");
  });
});

describe("client portal hosting placeholders", () => {
  it("exposes hosting nav and example.com Business Hosting card data", () => {
    expect(PORTAL_NAV.map((item) => item.to)).toContain("/hosting");
    const account = PLACEHOLDER_HOSTING_ACCOUNTS[0];
    expect(account?.domain).toBe("example.com");
    expect(account?.packageName).toBe("Business Hosting");
    expect(account?.statusLabel).toBe("Active");
    expect(formatUsagePair(account!.diskUsedBytes, account!.diskLimitBytes)).toBe("14 GB / 50 GB");
    expect(formatUsagePair(account!.bandwidthUsedBytes, account!.bandwidthLimitBytes)).toBe(
      "34 GB / 500 GB",
    );
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
