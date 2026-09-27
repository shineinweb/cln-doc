/**
 * Explicitly forbidden AI execution paths.
 *
 * DENIED:
 *   AI → production server → randomly change files
 *
 * Coding AI must follow the delivery pipeline instead:
 *   AI Code → Branch → Test → PR → Human Review → Merge → Deploy
 */

export const FORBIDDEN_AI_PATHS = [
  {
    id: "ai_production_random_file_changes",
    diagram: "AI → production server → randomly change files",
    reason:
      "Coding AI must never SSH/SFTP/API into production hosts to mutate files. Changes go through PR → human review → merge → deploy.",
  },
] as const;

export type ForbiddenAiPathId = (typeof FORBIDDEN_AI_PATHS)[number]["id"];

export class ForbiddenAiPathError extends Error {
  readonly pathId: ForbiddenAiPathId;

  constructor(pathId: ForbiddenAiPathId, message?: string) {
    const entry = FORBIDDEN_AI_PATHS.find((item) => item.id === pathId);
    super(message ?? entry?.reason ?? `Forbidden AI path: ${pathId}`);
    this.name = "ForbiddenAiPathError";
    this.pathId = pathId;
  }
}

/** Always throws — production direct file mutation is never allowed. */
export function assertNotProductionFileMutation(): never {
  throw new ForbiddenAiPathError("ai_production_random_file_changes");
}

/**
 * Guard for tool/runtime planners: reject any attempt to target production
 * hosts for arbitrary filesystem writes.
 */
export function assertCodingPathAllowed(input: {
  /** True when the tool would mutate files on a live production host. */
  mutatesProductionFiles: boolean;
}): void {
  if (input.mutatesProductionFiles) {
    assertNotProductionFileMutation();
  }
}

export function isForbiddenAiPathDiagram(diagram: string): boolean {
  const normalized = diagram.replace(/\s+/g, " ").trim().toLowerCase();
  return FORBIDDEN_AI_PATHS.some(
    (item) => item.diagram.replace(/\s+/g, " ").trim().toLowerCase() === normalized,
  );
}
