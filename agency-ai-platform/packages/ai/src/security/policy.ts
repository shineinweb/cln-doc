/**
 * AI security — kill switch, quotas, and risk defaults.
 * PLACEHOLDER: SystemSetting / FeatureFlag enforcement lands with Nest wiring.
 */

export type AiSecurityPolicy = {
  /** Master kill switch — when false, AiService must refuse completions. */
  enabled: boolean;
  maxTokensPerRequest: number;
  maxToolIterations: number;
  allowHighRiskTools: boolean;
};

export const DEFAULT_AI_SECURITY_POLICY: AiSecurityPolicy = {
  enabled: true,
  maxTokensPerRequest: 4_096,
  maxToolIterations: 8,
  allowHighRiskTools: false,
};

export function assertAiEnabled(policy: AiSecurityPolicy = DEFAULT_AI_SECURITY_POLICY): void {
  if (!policy.enabled) {
    throw new Error("AI is disabled by security policy (ai.enabled=false)");
  }
}

export function clampMaxTokens(
  requested: number | undefined,
  policy: AiSecurityPolicy = DEFAULT_AI_SECURITY_POLICY,
): number {
  const value = requested ?? policy.maxTokensPerRequest;
  return Math.min(Math.max(1, value), policy.maxTokensPerRequest);
}
