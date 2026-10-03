import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

export const zoneSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string(),
  code: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const cropCycleSummarySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  name: z.string(),
  cultivar: z.string(),
  plantCount: z.number().int(),
  stage: z.string(),
  startDate: z.string(),
  expectedHarvestDate: z.string(),
  status: z.string(),
  cycleDay: z.number().int(),
});

export const cycleEventSchema = z.object({
  id: z.string(),
  occurredOn: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
});

export const cycleMovementSchema = z.object({
  id: z.string(),
  occurredOn: z.string(),
  fromLabel: z.string(),
  toLabel: z.string(),
  plantCount: z.number().int(),
  note: z.string().nullable(),
});

export const cycleObservationSchema = z.object({
  id: z.string(),
  occurredOn: z.string(),
  authorName: z.string(),
  body: z.string(),
});

export const cycleLaborEntrySchema = z.object({
  id: z.string(),
  occurredOn: z.string(),
  personName: z.string(),
  hours: z.number(),
  note: z.string().nullable(),
});

export const harvestResultSummarySchema = z.object({
  id: z.string(),
  recordedOn: z.string(),
  summary: z.string(),
});

export const operatingHistorySchema = z.object({
  events: z.array(cycleEventSchema),
  movements: z.array(cycleMovementSchema),
  observations: z.array(cycleObservationSchema),
  laborEntries: z.array(cycleLaborEntrySchema),
  harvestSummary: harvestResultSummarySchema.nullable(),
});

export const roomTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  dueOn: z.string(),
  status: z.string(),
  assigneeLabel: z.string(),
});

export const environmentMetricSchema = z.enum(['temperature', 'relative_humidity', 'co2', 'substrate']);

export const readingQualitySchema = z.enum(['good', 'suspect', 'bad']);

export const roomAlertSchema = z.object({
  id: z.string(),
  message: z.string(),
  metric: z.string().nullable(),
  kind: z.string().nullable(),
});

export const environmentalReadingSchema = z.object({
  id: z.string(),
  recordedAt: z.string(),
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  deviceId: z.string(),
  quality: z.string(),
  isSample: z.boolean(),
});

export const latestReadingSlotSchema = z.object({
  metric: z.string(),
  id: z.string().nullable(),
  recordedAt: z.string().nullable(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  deviceId: z.string().nullable(),
  quality: z.string().nullable(),
  isSample: z.boolean(),
  stale: z.boolean(),
});

export const createReadingSchema = z.object({
  deviceId: z.string().trim().min(1, 'Enter a device identity.').max(120),
  metric: environmentMetricSchema,
  value: z.number().finite(),
  unit: z.string().trim().min(1, 'Enter a unit.').max(20),
  recordedAt: z.string().trim().min(1, 'Enter a timestamp.'),
  quality: readingQualitySchema,
  isSample: z.boolean().default(false),
});

export const importReadingsSchema = z.object({
  csv: z.string().trim().min(1, 'Choose a CSV file.').max(100_000),
});

export const importReadingsResultSchema = z.object({
  imported: z.number().int(),
  readings: z.array(environmentalReadingSchema),
});

export const createAlertRuleSchema = z
  .object({
    metric: environmentMetricSchema,
    kind: z.enum(['range', 'stale']),
    minValue: z.number().finite().nullable().optional(),
    maxValue: z.number().finite().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === 'range' && value.minValue == null && value.maxValue == null) {
      context.addIssue({
        code: 'custom',
        message: 'A range rule needs a minimum or a maximum.',
        path: ['minValue'],
      });
    }
  });

export const alertRuleSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  metric: z.string(),
  kind: z.string(),
  minValue: z.number().nullable(),
  maxValue: z.number().nullable(),
  enabled: z.boolean(),
});

export const metrcSyncSchema = z.object({
  id: z.string(),
  succeededAt: z.string(),
  isSample: z.boolean(),
});

export const roomSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  name: z.string(),
  code: z.string(),
  roomType: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  zones: z.array(zoneSchema),
  currentCycle: cropCycleSummarySchema.nullable(),
});

export const roomDetailSchema = roomSchema.extend({
  siteName: z.string(),
  siteCode: z.string(),
  siteTimezone: z.string(),
  operatingHistory: operatingHistorySchema.nullable(),
  tasksDueToday: z.array(roomTaskSchema),
  staleAfterMinutes: z.number().int(),
  activeAlerts: z.array(roomAlertSchema),
  latestReadings: z.array(latestReadingSlotSchema),
  readingHistory: z.array(environmentalReadingSchema),
  lastMetrcSync: metrcSyncSchema.nullable(),
});

export const cycleTaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  dueOn: z.string(),
  status: z.string(),
  assigneeLabel: z.string(),
  offsetDays: z.number().int(),
});

export const cycleWorkflowSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  versionId: z.string(),
  versionNumber: z.number().int(),
  latestVersionId: z.string(),
  latestVersionNumber: z.number().int(),
  durationDays: z.number().int(),
  startingEvent: z.string(),
});

export const cropCycleDetailSchema = cropCycleSummarySchema.extend({
  siteId: z.string(),
  siteName: z.string(),
  siteTimezone: z.string(),
  roomName: z.string(),
  operatingHistory: operatingHistorySchema,
  workflow: cycleWorkflowSchema.nullable(),
  tasks: z.array(cycleTaskSummarySchema),
});

export const assigneeTypeSchema = z.enum(['team', 'role', 'employee']);

export const workflowTaskInputSchema = z.object({
  taskKey: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_-]+$/, 'Use a short key such as scout.'),
  title: z.string().trim().min(1).max(191),
  offsetDays: z.number().int().min(0).max(365),
  assigneeType: assigneeTypeSchema,
  teamId: z.string().nullable().optional(),
  roleId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  instructions: z.string().trim().min(1).max(4000),
  checklist: z.array(z.string().trim().min(1).max(500)).min(1).max(30),
  sopRecordId: z.string().nullable().optional(),
  requiresNotes: z.boolean(),
  requiresMeasurement: z.boolean(),
  requiresPhoto: z.boolean(),
  requiresSignOff: z.boolean(),
  dependsOnKey: z.string().nullable().optional(),
  requiresApproval: z.boolean(),
});

export const workflowVersionInputSchema = z.object({
  durationDays: z.number().int().min(1).max(365),
  startingEvent: z.string().trim().min(1).max(191),
  tasks: z.array(workflowTaskInputSchema).min(1).max(40),
});

export const createWorkflowTemplateSchema = workflowVersionInputSchema.extend({
  name: z.string().trim().min(1).max(191),
});

export const createSopSchema = z.object({
  title: z.string().trim().min(1).max(191),
  summary: z.string().trim().min(1).max(4000),
});

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(191),
  memberIds: z.array(z.string()).min(1),
});

export const teamSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const startCycleSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(191),
  cultivar: z.string().trim().min(1).max(191),
  plantCount: z.number().int().positive(),
  stage: z.string().trim().min(1).max(191),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedHarvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  templateVersionId: z.string().min(1),
});

export const applyWorkflowSchema = z.object({
  versionId: z.string().min(1),
});

export const rescheduleCycleSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const taskCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const taskEvidenceSchema = z.object({
  notes: z.string().trim().max(4000).nullable().optional(),
  measurementValue: z.number().nullable().optional(),
  measurementUnit: z.string().trim().max(40).nullable().optional(),
  signOff: z.boolean().optional(),
});

export const taskChecklistSchema = z.object({
  itemId: z.string().min(1),
  checked: z.boolean(),
});

export const sopSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
});

export const workflowTaskViewSchema = z.object({
  id: z.string(),
  taskKey: z.string(),
  title: z.string(),
  offsetDays: z.number().int(),
  assigneeType: assigneeTypeSchema,
  assigneeLabel: z.string(),
  teamId: z.string().nullable(),
  roleId: z.string().nullable(),
  userId: z.string().nullable(),
  instructions: z.string(),
  checklist: z.array(z.string()),
  sop: sopSummarySchema.nullable(),
  requiresNotes: z.boolean(),
  requiresMeasurement: z.boolean(),
  requiresPhoto: z.boolean(),
  requiresSignOff: z.boolean(),
  dependsOnKey: z.string().nullable(),
  requiresApproval: z.boolean(),
});

export const workflowVersionViewSchema = z.object({
  id: z.string(),
  versionNumber: z.number().int(),
  durationDays: z.number().int(),
  startingEvent: z.string(),
  tasks: z.array(workflowTaskViewSchema),
});

export const workflowTemplateViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentVersion: workflowVersionViewSchema,
  versionCount: z.number().int(),
});

export const workflowDirectorySchema = z.object({
  roles: z.array(z.object({ id: z.string(), name: z.string(), key: z.string() })),
  teams: z.array(z.object({ id: z.string(), name: z.string(), memberNames: z.array(z.string()) })),
  employees: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  sops: z.array(sopSummarySchema),
  templates: z.array(workflowTemplateViewSchema),
});

export const startedCycleSchema = z.object({
  id: z.string(),
  tasks: z.array(cycleTaskSummarySchema),
});

export const rescheduleResultSchema = z.object({
  persisted: z.literal(true),
  startDate: z.string(),
  expectedHarvestDate: z.string(),
  tasks: z.array(cycleTaskSummarySchema),
});

export const reschedulePreviewSchema = z.object({
  persisted: z.literal(false),
  startDate: z.object({ from: z.string(), to: z.string() }),
  expectedHarvestDate: z.object({ from: z.string(), to: z.string() }),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      fromDueOn: z.string(),
      toDueOn: z.string(),
    }),
  ),
});

export const taskChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  checked: z.boolean(),
});

export const taskCommentViewSchema = z.object({
  id: z.string(),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const taskAttachmentViewSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  byteSize: z.number().int(),
});

export const cycleTaskDetailSchema = z.object({
  id: z.string(),
  cycleId: z.string(),
  cycleName: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  title: z.string(),
  instructions: z.string(),
  dueOn: z.string(),
  status: z.string(),
  assigneeType: assigneeTypeSchema,
  assigneeLabel: z.string(),
  checklist: z.array(taskChecklistItemSchema),
  requiresNotes: z.boolean(),
  requiresMeasurement: z.boolean(),
  requiresPhoto: z.boolean(),
  requiresSignOff: z.boolean(),
  requiresApproval: z.boolean(),
  dependsOnTitle: z.string().nullable(),
  sop: sopSummarySchema.nullable(),
  notes: z.string().nullable(),
  measurementValue: z.number().nullable(),
  measurementUnit: z.string().nullable(),
  signedOffAt: z.string().nullable(),
  signedOffByName: z.string().nullable(),
  comments: z.array(taskCommentViewSchema),
  attachments: z.array(taskAttachmentViewSchema),
});

export const workspaceTodaySchema = z.object({
  date: z.string(),
  tasks: z.array(cycleTaskDetailSchema),
});

export const siteSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  code: z.string(),
  addressLine1: z.string().nullable(),
  city: z.string().nullable(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  timezone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  rooms: z.array(roomSchema),
});

export const siteListSchema = z.array(siteSchema);

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  isOrgAdmin: z.boolean(),
  siteIds: z.array(z.string()),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresInSeconds: z.number(),
  user: sessionUserSchema,
});

export const organizationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  siteCount: z.number(),
});

export const metrcPlantPayloadSchema = z.object({
  Label: z.string().trim().min(1),
  StrainName: z.string().trim().min(1),
  GrowthPhase: z.string().trim().min(1),
  LocationName: z.string().trim().optional(),
});

export const metrcInventoryPayloadSchema = z.object({
  LicenseNumber: z.string().trim().min(1),
  Plants: z.array(metrcPlantPayloadSchema),
});

export const movePlantSchema = z.object({
  roomId: z.string().min(1),
});

export const changePlantStageSchema = z.object({
  stage: z.string().trim().min(1).max(40),
});

export const plantObservationSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

export const metrcDiscrepancySchema = z.object({
  id: z.string(),
  tag: z.string(),
  kind: z.enum(['extra_tag', 'missing_tag']),
});

export const metrcImportSummarySchema = z.object({
  id: z.string(),
  source: z.string(),
  status: z.string(),
  matchedCount: z.number().int(),
  discrepancyCount: z.number().int(),
  importedAt: z.string(),
  discrepancies: z.array(metrcDiscrepancySchema),
});

export const sandboxOutcomeSchema = z.enum(['success', 'failure', 'uncertain']);

export const queueSubmissionSchema = z
  .object({
    plantEventId: z.string().min(1).optional(),
    packageId: z.string().min(1).optional(),
    sandboxOutcome: sandboxOutcomeSchema,
  })
  .refine((value) => Number(Boolean(value.plantEventId)) + Number(Boolean(value.packageId)) === 1, {
    message: 'Queue a plant event or a finished package.',
  });

export const reviewSubmissionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    sandboxOutcome: sandboxOutcomeSchema.optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.decision === 'reject' || value.sandboxOutcome, {
    message: 'Choose a sandbox outcome.',
  });

export const reconcileSubmissionSchema = z.object({
  finding: z.enum(['landed', 'not_landed']),
});

export const submissionAttemptSchema = z.object({
  id: z.string(),
  actorName: z.string(),
  occurredAt: z.string(),
  requestId: z.string(),
  outcome: z.string(),
  detail: z.string().nullable(),
  reconciliationResult: z.enum(['landed', 'not_landed']).nullable(),
  reconciledAt: z.string().nullable(),
  reconciledByName: z.string().nullable(),
});

export const submissionViewSchema = z.object({
  id: z.string(),
  licenseId: z.string(),
  licenseNumber: z.string(),
  plantId: z.string().nullable(),
  plantTag: z.string().nullable(),
  plantEventId: z.string().nullable(),
  packageId: z.string().nullable(),
  packageLabel: z.string().nullable(),
  eventType: z.string(),
  eventNote: z.string().nullable(),
  status: z.string(),
  sandboxOutcome: z.string(),
  requestedByName: z.string(),
  requestedAt: z.string(),
  reviewerName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  rejectionNote: z.string().nullable(),
  canQueueAgain: z.boolean(),
  attempt: submissionAttemptSchema.nullable(),
});

export const complianceLicenseSchema = z.object({
  id: z.string(),
  licenseNumber: z.string(),
  licenseType: z.string(),
  siteNames: z.array(z.string()),
  plantCount: z.number().int(),
  latestImport: metrcImportSummarySchema.nullable(),
  submissions: z.array(submissionViewSchema),
});

export const complianceOverviewSchema = z.object({
  licenses: z.array(complianceLicenseSchema),
});

export const inventoryPlantSchema = z.object({
  id: z.string(),
  tag: z.string(),
  strainName: z.string(),
  stage: z.string(),
  status: z.string(),
  roomName: z.string().nullable(),
  cycleName: z.string().nullable(),
});

export const licenseInventorySchema = z.object({
  id: z.string(),
  licenseNumber: z.string(),
  licenseType: z.string(),
  siteNames: z.array(z.string()),
  plantCount: z.number().int(),
  listedCount: z.number().int(),
  plants: z.array(inventoryPlantSchema),
  latestImport: metrcImportSummarySchema.nullable(),
});

export const plantEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  occurredAt: z.string(),
  actorName: z.string(),
  fromRoomName: z.string().nullable(),
  toRoomName: z.string().nullable(),
  fromStage: z.string().nullable(),
  toStage: z.string().nullable(),
  note: z.string().nullable(),
});

const gramsSchema = z.number().int().positive().max(1_000_000);

export const weightLedgerSchema = z.object({
  wetWeightGrams: z.number().int().nullable(),
  dryWeightGrams: z.number().int().nullable(),
  packageWeightGrams: z.number().int(),
  wasteWeightGrams: z.number().int(),
  unaccountedGrams: z.number().int().nullable(),
});

export const harvestStepSchema = z.object({
  id: z.string(),
  kind: z.string(),
  actorName: z.string(),
  occurredAt: z.string(),
  weightGrams: z.number().int().nullable(),
  roomName: z.string().nullable(),
  note: z.string().nullable(),
});

export const harvestPlantSchema = z.object({
  plantId: z.string(),
  tag: z.string(),
});

export const harvestWasteSchema = z.object({
  id: z.string(),
  harvestId: z.string(),
  weightGrams: z.number().int(),
  note: z.string().nullable(),
  actorName: z.string(),
  recordedAt: z.string(),
});

export const createHarvestSchema = z.object({
  cycleId: z.string().min(1),
});

export const recordWeightSchema = z.object({
  grams: gramsSchema,
});

export const startDryingSchema = z.object({
  roomId: z.string().min(1).optional(),
});

export const recordWasteSchema = z.object({
  grams: gramsSchema,
  note: z.string().trim().max(500).optional(),
});

export const createPackageSchema = z.object({
  label: z.string().trim().min(1).max(64),
  grams: gramsSchema,
  tags: z.array(z.string().trim().min(1)).min(1),
});

export const harvestSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  licenseNumber: z.string(),
  siteName: z.string().nullable(),
  plantCount: z.number().int(),
  ledger: weightLedgerSchema,
});

export const harvestListSchema = z.array(harvestSummarySchema);

export const harvestWasteListSchema = z.array(harvestWasteSchema);

export const harvestDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  licenseId: z.string(),
  licenseNumber: z.string(),
  siteName: z.string().nullable(),
  cycleName: z.string().nullable(),
  roomName: z.string().nullable(),
  plantCount: z.number().int(),
  plants: z.array(harvestPlantSchema),
  steps: z.array(harvestStepSchema),
  wastes: z.array(harvestWasteSchema),
  packages: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      weightGrams: z.number().int(),
      sourceTagCount: z.number().int(),
    }),
  ),
  ledger: weightLedgerSchema,
});

export const packageSourceTagSchema = z.object({
  plantId: z.string(),
  tag: z.string(),
});

export const packageDetailSchema = z.object({
  id: z.string(),
  harvestId: z.string(),
  harvestName: z.string(),
  licenseId: z.string(),
  licenseNumber: z.string(),
  label: z.string(),
  weightGrams: z.number().int(),
  actorName: z.string(),
  recordedAt: z.string(),
  sourceTags: z.array(packageSourceTagSchema),
  ledger: weightLedgerSchema,
  submission: z
    .object({
      id: z.string(),
      status: z.string(),
    })
    .nullable(),
});

export const plantDetailSchema = z.object({
  id: z.string(),
  tag: z.string(),
  strainName: z.string(),
  batchName: z.string(),
  stage: z.string(),
  status: z.string(),
  licenseId: z.string(),
  licenseNumber: z.string(),
  siteNames: z.array(z.string()),
  roomId: z.string().nullable(),
  roomName: z.string().nullable(),
  cycleId: z.string().nullable(),
  cycleName: z.string().nullable(),
  events: z.array(plantEventSchema),
});

export const laborCostLineSchema = z.object({
  entryId: z.string(),
  rateId: z.string().nullable(),
  personName: z.string(),
  hours: z.number(),
  hourlyCents: z.number().int().nullable(),
  costCents: z.number().int().nullable(),
  formula: z.string(),
});

export const inputCostLineSchema = z.object({
  inputId: z.string(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unitCostCents: z.number().int(),
  costCents: z.number().int(),
  formula: z.string(),
});

export const cycleReportSchema = z.object({
  cycleId: z.string(),
  cycleName: z.string(),
  cultivar: z.string(),
  roomId: z.string(),
  roomName: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  siteTimezone: z.string(),
  yield: z.object({
    present: z.boolean(),
    absentReason: z.string().nullable(),
    harvestId: z.string().nullable(),
    plantCount: z.number().int().nullable(),
    wetWeightGrams: z.number().int().nullable(),
    dryWeightGrams: z.number().int().nullable(),
    packageWeightGrams: z.number().int().nullable(),
    wasteWeightGrams: z.number().int().nullable(),
    unaccountedGrams: z.number().int().nullable(),
    gramsPerPlant: z.number().nullable(),
    gramsPerPlantFormula: z.string(),
    ledgerFormula: z.string(),
  }),
  duration: z.object({
    startDate: z.string(),
    harvestAt: z.string().nullable(),
    daysSinceStart: z.number().int().nullable(),
    completedDurationDays: z.number().int().nullable(),
    formula: z.string(),
  }),
  labor: z.object({
    lines: z.array(laborCostLineSchema),
    totalHours: z.number(),
    totalCostCents: z.number().int(),
    formula: z.string(),
  }),
  inputs: z.object({
    lines: z.array(inputCostLineSchema),
    totalCostCents: z.number().int(),
    formula: z.string(),
  }),
  totalCostCents: z.number().int(),
  totalCostFormula: z.string(),
  excludedSampleReadingCount: z.number().int(),
  sampleExclusionFormula: z.string(),
});

export const siteReportSchema = z.object({
  siteId: z.string(),
  siteName: z.string(),
  siteTimezone: z.string(),
  cycles: z.array(cycleReportSchema),
});

export const comparisonReportSchema = z.object({
  cycles: z.array(cycleReportSchema),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type CropCycleSummary = z.infer<typeof cropCycleSummarySchema>;
export type OperatingHistory = z.infer<typeof operatingHistorySchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomDetail = z.infer<typeof roomDetailSchema>;
export type CropCycleDetail = z.infer<typeof cropCycleDetailSchema>;
export type CycleTaskSummary = z.infer<typeof cycleTaskSummarySchema>;
export type WorkflowTaskInput = z.infer<typeof workflowTaskInputSchema>;
export type WorkflowVersionInput = z.infer<typeof workflowVersionInputSchema>;
export type CreateWorkflowTemplate = z.infer<typeof createWorkflowTemplateSchema>;
export type CreateSop = z.infer<typeof createSopSchema>;
export type CreateTeam = z.infer<typeof createTeamSchema>;
export type StartCycle = z.infer<typeof startCycleSchema>;
export type ApplyWorkflow = z.infer<typeof applyWorkflowSchema>;
export type RescheduleCycle = z.infer<typeof rescheduleCycleSchema>;
export type TaskCommentInput = z.infer<typeof taskCommentSchema>;
export type TaskEvidenceInput = z.infer<typeof taskEvidenceSchema>;
export type TaskChecklistInput = z.infer<typeof taskChecklistSchema>;
export type WorkflowTemplateView = z.infer<typeof workflowTemplateViewSchema>;
export type WorkflowDirectory = z.infer<typeof workflowDirectorySchema>;
export type StartedCycle = z.infer<typeof startedCycleSchema>;
export type RescheduleResult = z.infer<typeof rescheduleResultSchema>;
export type ReschedulePreview = z.infer<typeof reschedulePreviewSchema>;
export type CycleTaskDetail = z.infer<typeof cycleTaskDetailSchema>;
export type WorkspaceToday = z.infer<typeof workspaceTodaySchema>;
export type RoomTask = z.infer<typeof roomTaskSchema>;
export type RoomAlert = z.infer<typeof roomAlertSchema>;
export type EnvironmentalReading = z.infer<typeof environmentalReadingSchema>;
export type LatestReadingSlot = z.infer<typeof latestReadingSlotSchema>;
export type CreateReading = z.infer<typeof createReadingSchema>;
export type ImportReadings = z.infer<typeof importReadingsSchema>;
export type ImportReadingsResult = z.infer<typeof importReadingsResultSchema>;
export type CreateAlertRule = z.infer<typeof createAlertRuleSchema>;
export type AlertRule = z.infer<typeof alertRuleSchema>;
export type MetrcSync = z.infer<typeof metrcSyncSchema>;
export type Site = z.infer<typeof siteSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
export type MetrcInventoryPayload = z.infer<typeof metrcInventoryPayloadSchema>;
export type MovePlant = z.infer<typeof movePlantSchema>;
export type ChangePlantStage = z.infer<typeof changePlantStageSchema>;
export type PlantObservation = z.infer<typeof plantObservationSchema>;
export type ComplianceOverview = z.infer<typeof complianceOverviewSchema>;
export type LicenseInventory = z.infer<typeof licenseInventorySchema>;
export type PlantDetail = z.infer<typeof plantDetailSchema>;
export type MetrcImportSummary = z.infer<typeof metrcImportSummarySchema>;
export type QueueSubmission = z.infer<typeof queueSubmissionSchema>;
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
export type ReconcileSubmission = z.infer<typeof reconcileSubmissionSchema>;
export type SubmissionView = z.infer<typeof submissionViewSchema>;
export type WeightLedger = z.infer<typeof weightLedgerSchema>;
export type CreateHarvest = z.infer<typeof createHarvestSchema>;
export type RecordWeight = z.infer<typeof recordWeightSchema>;
export type StartDrying = z.infer<typeof startDryingSchema>;
export type RecordWaste = z.infer<typeof recordWasteSchema>;
export type CreatePackage = z.infer<typeof createPackageSchema>;
export type HarvestDetail = z.infer<typeof harvestDetailSchema>;
export type HarvestSummary = z.infer<typeof harvestSummarySchema>;
export type PackageDetail = z.infer<typeof packageDetailSchema>;
export type HarvestWasteView = z.infer<typeof harvestWasteSchema>;
export type CycleReport = z.infer<typeof cycleReportSchema>;
export type SiteReport = z.infer<typeof siteReportSchema>;
export type ComparisonReport = z.infer<typeof comparisonReportSchema>;
