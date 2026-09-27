/** Billing package — plans, invoices, payment adapters. */
export type PlanId = "starter" | "growth" | "scale";

export type Plan = {
  id: PlanId;
  name: string;
  monthlyCents: number;
};

export const PLANS: Plan[] = [
  { id: "starter", name: "Starter", monthlyCents: 9900 },
  { id: "growth", name: "Growth", monthlyCents: 24900 },
  { id: "scale", name: "Scale", monthlyCents: 59900 },
];

export function getPlan(id: PlanId): Plan | undefined {
  return PLANS.find((plan) => plan.id === id);
}
