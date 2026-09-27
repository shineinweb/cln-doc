/**
 * Coding AI tool surface (staff / project-scoped).
 * No autonomous production deploys — PRs/branches require approval.
 */

import type { AiToolDefinition } from "./types";

export const CODING_TOOL_NAMES = [
  "readRepository",
  "searchCode",
  "explainCode",
  "diagnoseErrors",
  "generateCode",
  "generateTests",
  "runTests",
  "reviewChanges",
  "createBranches",
  "createPullRequests",
] as const;

export type CodingToolName = (typeof CODING_TOOL_NAMES)[number];

export const CODING_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "readRepository",
    description: "Read repository tree, files, and metadata for the scoped project.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      path: {
        type: "string",
        description: "Optional path within the repository.",
        required: false,
      },
      ref: {
        type: "string",
        description: "Optional git ref (branch, tag, or SHA).",
        required: false,
      },
    },
  },
  {
    name: "searchCode",
    description: "Search the repository for symbols, strings, or path patterns.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      query: {
        type: "string",
        description: "Search query (text or regex).",
        required: true,
      },
      path: {
        type: "string",
        description: "Optional path scope.",
        required: false,
      },
    },
  },
  {
    name: "explainCode",
    description: "Explain selected files, symbols, or diffs in plain language.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      path: {
        type: "string",
        description: "File or directory to explain.",
        required: true,
      },
      symbol: {
        type: "string",
        description: "Optional symbol name within the file.",
        required: false,
      },
    },
  },
  {
    name: "diagnoseErrors",
    description: "Diagnose build, typecheck, lint, or runtime error output.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      log: {
        type: "string",
        description: "Error log or failing command output.",
        required: true,
      },
      contextPath: {
        type: "string",
        description: "Optional related file path.",
        required: false,
      },
    },
  },
  {
    name: "generateCode",
    description:
      "Propose code changes as a draft patch (does not apply to production).",
    risk: "write",
    requiresApproval: false,
    parameters: {
      instruction: {
        type: "string",
        description: "What to implement or change.",
        required: true,
      },
      path: {
        type: "string",
        description: "Primary file or directory target.",
        required: false,
      },
    },
  },
  {
    name: "generateTests",
    description: "Propose unit/integration tests as a draft for the scoped change.",
    risk: "write",
    requiresApproval: false,
    parameters: {
      path: {
        type: "string",
        description: "Source file or module under test.",
        required: true,
      },
      framework: {
        type: "string",
        description: "Optional test framework hint (e.g. vitest).",
        required: false,
      },
    },
  },
  {
    name: "runTests",
    description: "Run the project test suite (or a scoped subset) in a sandbox.",
    risk: "write",
    requiresApproval: false,
    parameters: {
      filter: {
        type: "string",
        description: "Optional test file or name filter.",
        required: false,
      },
      packageName: {
        type: "string",
        description: "Optional package/workspace filter.",
        required: false,
      },
    },
  },
  {
    name: "reviewChanges",
    description: "Review a diff or working-tree changes for bugs and policy issues.",
    risk: "read",
    requiresApproval: false,
    parameters: {
      baseRef: {
        type: "string",
        description: "Optional base ref for the diff.",
        required: false,
      },
      diff: {
        type: "string",
        description: "Optional raw diff text if not reading git state.",
        required: false,
      },
    },
  },
  {
    name: "createBranches",
    description: "Create a feature branch from the configured base (staff approval).",
    risk: "write",
    requiresApproval: true,
    parameters: {
      name: {
        type: "string",
        description: "Branch name (must match repo branch policy).",
        required: true,
      },
      baseRef: {
        type: "string",
        description: "Optional base branch (default: configured base).",
        required: false,
      },
    },
  },
  {
    name: "createPullRequests",
    description:
      "Open a pull request for the current branch (staff approval; no auto-merge).",
    risk: "write",
    requiresApproval: true,
    parameters: {
      title: {
        type: "string",
        description: "Pull request title.",
        required: true,
      },
      body: {
        type: "string",
        description: "Pull request description.",
        required: true,
      },
      baseRef: {
        type: "string",
        description: "Optional PR base branch.",
        required: false,
      },
      draft: {
        type: "boolean",
        description: "Whether to create as draft (default true).",
        required: false,
      },
    },
  },
] as const;
