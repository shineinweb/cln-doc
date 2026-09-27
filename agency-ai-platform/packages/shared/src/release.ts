/**
 * Canonical platform release pipeline.
 *
 * Development → GitHub → Staging → Automated tests → Manual approval → Production
 *
 * Production is never reached without human approval. Coding AI must not
 * advance past GitHub (PRs); deploy to Production is human / protected CD only.
 */

export const RELEASE_PIPELINE_STAGES = [
  "development",
  "github",
  "staging",
  "automated_tests",
  "manual_approval",
  "production",
] as const;

export type ReleasePipelineStage = (typeof RELEASE_PIPELINE_STAGES)[number];

export type ReleasePipelineActor = "developer" | "ci" | "human";

export type ReleasePipelineStageDefinition = {
  stage: ReleasePipelineStage;
  label: string;
  description: string;
  actors: readonly ReleasePipelineActor[];
  /** If true, only a human may advance past this stage. */
  requiresManualApproval: boolean;
};

export const RELEASE_PIPELINE_DIAGRAM = `
Development
     ↓
GitHub
     ↓
Staging
     ↓
Automated tests
     ↓
Manual approval
     ↓
Production
`.trim();

export const RELEASE_PIPELINE: readonly ReleasePipelineStageDefinition[] = [
  {
    stage: "development",
    label: "Development",
    description: "Local feature work on a cursor/* branch off dev.",
    actors: ["developer"],
    requiresManualApproval: false,
  },
  {
    stage: "github",
    label: "GitHub",
    description: "Push, pull request, and code review against the protected base branch.",
    actors: ["developer", "ci", "human"],
    requiresManualApproval: false,
  },
  {
    stage: "staging",
    label: "Staging",
    description: "Deploy the candidate build to the staging environment for soak.",
    actors: ["ci", "human"],
    requiresManualApproval: false,
  },
  {
    stage: "automated_tests",
    label: "Automated tests",
    description:
      "Lint, typecheck, unit/integration/API/authz/tenant suites, and build on the staging candidate.",
    actors: ["ci"],
    requiresManualApproval: false,
  },
  {
    stage: "manual_approval",
    label: "Manual approval",
    description: "Human signs off promotion (GitHub Environment protection / release approver).",
    actors: ["human"],
    requiresManualApproval: true,
  },
  {
    stage: "production",
    label: "Production",
    description: "Deploy to production after approval — never by Coding AI alone.",
    actors: ["ci", "human"],
    requiresManualApproval: true,
  },
] as const;

export function isReleasePipelineStage(value: string): value is ReleasePipelineStage {
  return (RELEASE_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function getReleasePipelineStage(
  stage: ReleasePipelineStage,
): ReleasePipelineStageDefinition {
  const found = RELEASE_PIPELINE.find((item) => item.stage === stage);
  if (!found) {
    throw new Error(`Unknown release pipeline stage: ${stage}`);
  }
  return found;
}

/** Next stage, or null after Production. */
export function getNextReleasePipelineStage(
  stage: ReleasePipelineStage,
): ReleasePipelineStage | null {
  const index = RELEASE_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= RELEASE_PIPELINE_STAGES.length - 1) return null;
  return RELEASE_PIPELINE_STAGES[index + 1] ?? null;
}

/** CI may auto-advance only stages that do not require manual approval. */
export function canCiAutoAdvanceFrom(stage: ReleasePipelineStage): boolean {
  const current = getReleasePipelineStage(stage);
  if (current.requiresManualApproval) return false;
  const next = getNextReleasePipelineStage(stage);
  if (!next) return false;
  return !getReleasePipelineStage(next).requiresManualApproval;
}
