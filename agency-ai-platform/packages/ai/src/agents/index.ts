/** Agent definitions — AI Supervisor org chart + specialists. */
export {
  AI_AGENT_CODES,
  AI_AGENT_ROSTER,
  AI_ORG_CHART,
  getAgentDefinition,
  listAgentsByTier,
  listSpecialists,
} from "./roster";
export type { AiAgentCode, AiAgentDefinition, AiAgentTier } from "./roster";

export {
  CODING_PIPELINE,
  CODING_PIPELINE_DIAGRAM,
  CODING_PIPELINE_STAGES,
  canCodingAiActAtStage,
  getCodingPipelineStage,
  getNextCodingPipelineStage,
  isCodingPipelineStage,
  listCodingAiPipelineStages,
} from "./coding-pipeline";
export type {
  CodingPipelineActor,
  CodingPipelineStage,
  CodingPipelineStageDefinition,
} from "./coding-pipeline";
