/** AI tool registry (calls into other packages via providers). */
export {
  AI_TOOL_REGISTRY,
  AiToolUnwiredError,
  CODING_TOOL_NAMES,
  CODING_TOOLS,
  CUSTOMER_SUPPORT_TOOL_NAMES,
  CUSTOMER_SUPPORT_TOOLS,
  HOSTING_TOOL_NAMES,
  HOSTING_TOOLS,
  KNOWLEDGE_TOOL_NAMES,
  KNOWLEDGE_TOOLS,
  getTool,
  invokeTool,
  isCodingTool,
  isCustomerSupportTool,
  isHostingTool,
  isKnowledgeTool,
  listTools,
} from "./registry";
export type {
  AiToolDefinition,
  AiToolInvokeContext,
  AiToolRisk,
  CodingToolName,
  CustomerSupportToolName,
  HostingToolName,
  KnowledgeToolName,
} from "./registry";

export {
  AiApprovalRequiredError,
  assertToolApprovalGranted,
  invokeAuthorizedTool,
} from "./authorized-invoke";
export type { AuthorizedInvokeOptions } from "./authorized-invoke";
