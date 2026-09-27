/**
 * AI security — kill switch, quotas, and risk defaults.
 * PLACEHOLDER: SystemSetting / FeatureFlag enforcement lands with Nest wiring.
 *
 * Forbidden path (hard deny):
 *   AI → production server → randomly change files
 */

export type AiSecurityPolicy = {
  /** Master kill switch — when false, AiService must refuse completions. */
  enabled: boolean;
  maxTokensPerRequest: number;
  maxToolIterations: number;
  allowHighRiskTools: boolean;
  /**
   * Must remain false. Direct production filesystem mutation by AI is forbidden
   * (`AI → production server → randomly change files`).
   */
  allowProductionFileMutation: boolean;
};

export const DEFAULT_AI_SECURITY_POLICY: AiSecurityPolicy = {
  enabled: true,
  maxTokensPerRequest: 4_096,
  maxToolIterations: 8,
  allowHighRiskTools: false,
  allowProductionFileMutation: false,
};

export function assertAiEnabled(policy: AiSecurityPolicy = DEFAULT_AI_SECURITY_POLICY): void {
  if (!policy.enabled) {
    throw new Error("AI is disabled by security policy (ai.enabled=false)");
  }
  if (policy.allowProductionFileMutation) {
    throw new Error(
      "AI security policy forbids AI → production server → randomly change files",
    );
  }
}

export function clampMaxTokens(
  requested: number | undefined,
  policy: AiSecurityPolicy = DEFAULT_AI_SECURITY_POLICY,
): number {
  const value = requested ?? policy.maxTokensPerRequest;
  return Math.min(Math.max(1, value), policy.maxTokensPerRequest);
}
