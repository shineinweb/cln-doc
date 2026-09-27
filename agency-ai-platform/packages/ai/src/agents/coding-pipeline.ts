/**
 * Coding AI delivery pipeline — AI proposes; humans merge and deploy.
 *
 *   AI CODE → BRANCH → TEST → PULL REQUEST → HUMAN REVIEW → MERGE → DEPLOY
 *
 * Forbidden (see security/forbidden-paths):
 *   AI → production server → randomly change files
 */

import type { CodingToolName } from "../tools/coding-tools";

export const CODING_PIPELINE_STAGES = [
  "ai_code",
  "branch",
  "test",
  "pull_request",
  "human_review",
  "merge",
  "deploy",
] as const;

export type CodingPipelineStage = (typeof CODING_PIPELINE_STAGES)[number];

export type CodingPipelineActor = "coding_ai" | "human" | "ci";

export type CodingPipelineStageDefinition = {
  stage: CodingPipelineStage;
  label: string;
  description: string;
  /** Who may advance this stage. */
  actors: readonly CodingPipelineActor[];
  /** Coding tools typically used at this stage (empty for human-only). */
  tools: readonly CodingToolName[];
  /** If true, Coding AI must not execute this stage. */
  humanOnly: boolean;
};

export const CODING_PIPELINE_DIAGRAM = `
AI CODE
   ↓
BRANCH
   ↓
TEST
   ↓
PULL REQUEST
   ↓
HUMAN REVIEW
   ↓
MERGE
   ↓
DEPLOY
`.trim();

export const CODING_PIPELINE: readonly CodingPipelineStageDefinition[] = [
  {
    stage: "ai_code",
    label: "AI Code",
    description: "Generate, explain, diagnose, and draft code/test changes.",
    actors: ["coding_ai"],
    tools: [
      "readRepository",
      "searchCode",
      "explainCode",
      "diagnoseErrors",
      "generateCode",
      "generateTests",
      "reviewChanges",
    ],
    humanOnly: false,
  },
  {
    stage: "branch",
    label: "Branch",
    description: "Create a feature branch (approval required).",
    actors: ["coding_ai", "human"],
    tools: ["createBranches"],
    humanOnly: false,
  },
  {
    stage: "test",
    label: "Test",
    description: "Run sandboxed tests against the proposed change.",
    actors: ["coding_ai", "ci"],
    tools: ["runTests"],
    humanOnly: false,
  },
  {
    stage: "pull_request",
    label: "Pull Request",
    description: "Open a draft PR for staff review (approval required).",
    actors: ["coding_ai", "human"],
    tools: ["createPullRequests", "reviewChanges"],
    humanOnly: false,
  },
  {
    stage: "human_review",
    label: "Human Review",
    description: "Staff review the PR; approve, request changes, or deny.",
    actors: ["human"],
    tools: [],
    humanOnly: true,
  },
  {
    stage: "merge",
    label: "Merge",
    description: "Human merges the approved PR into the protected base branch.",
    actors: ["human"],
    tools: [],
    humanOnly: true,
  },
  {
    stage: "deploy",
    label: "Deploy",
    description: "Human-triggered or CD deploy after merge — never by Coding AI.",
    actors: ["human", "ci"],
    tools: [],
    humanOnly: true,
  },
] as const;

export function isCodingPipelineStage(value: string): value is CodingPipelineStage {
  return (CODING_PIPELINE_STAGES as readonly string[]).includes(value);
}

export function getCodingPipelineStage(stage: CodingPipelineStage): CodingPipelineStageDefinition {
  const found = CODING_PIPELINE.find((item) => item.stage === stage);
  if (!found) {
    throw new Error(`Unknown coding pipeline stage: ${stage}`);
  }
  return found;
}

/** Next stage in the pipeline, or null after Deploy. */
export function getNextCodingPipelineStage(stage: CodingPipelineStage): CodingPipelineStage | null {
  const index = CODING_PIPELINE_STAGES.indexOf(stage);
  if (index < 0 || index >= CODING_PIPELINE_STAGES.length - 1) return null;
  return CODING_PIPELINE_STAGES[index + 1] ?? null;
}

/** Stages Coding AI may participate in (excludes human-only merge/deploy/review). */
export function listCodingAiPipelineStages(): readonly CodingPipelineStageDefinition[] {
  return CODING_PIPELINE.filter((item) => !item.humanOnly);
}

export function canCodingAiActAtStage(stage: CodingPipelineStage): boolean {
  return !getCodingPipelineStage(stage).humanOnly;
}
