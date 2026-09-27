/** Hosting package — deploy targets, status helpers, HostingProvider contract. */
export type HostingStatus = "pending" | "provisioning" | "live" | "failed";

export type HostingSite = {
  id: string;
  domain: string;
  status: HostingStatus;
};

export function describeHostingStatus(status: HostingStatus): string {
  switch (status) {
    case "pending":
      return "Waiting to start";
    case "provisioning":
      return "Provisioning";
    case "live":
      return "Live";
    case "failed":
      return "Failed";
  }
}

export type {
  CreateHostingAccountInput,
  HostingAccount,
  HostingAccountStatus,
  HostingProvider,
  HostingProviderRef,
  HostingUsage,
} from "./hosting-provider";
