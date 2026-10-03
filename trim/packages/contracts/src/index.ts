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
});

export const roomAlertSchema = z.object({
  id: z.string(),
  message: z.string(),
});

export const environmentalReadingSchema = z.object({
  id: z.string(),
  recordedAt: z.string(),
  metric: z.string(),
  value: z.number(),
  unit: z.string(),
  isSample: z.boolean(),
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
  activeAlerts: z.array(roomAlertSchema),
  latestReadings: z.array(environmentalReadingSchema),
  lastMetrcSync: metrcSyncSchema.nullable(),
});

export const cropCycleDetailSchema = cropCycleSummarySchema.extend({
  siteId: z.string(),
  siteName: z.string(),
  siteTimezone: z.string(),
  roomName: z.string(),
  operatingHistory: operatingHistorySchema,
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

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type Zone = z.infer<typeof zoneSchema>;
export type CropCycleSummary = z.infer<typeof cropCycleSummarySchema>;
export type OperatingHistory = z.infer<typeof operatingHistorySchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomDetail = z.infer<typeof roomDetailSchema>;
export type CropCycleDetail = z.infer<typeof cropCycleDetailSchema>;
export type RoomTask = z.infer<typeof roomTaskSchema>;
export type RoomAlert = z.infer<typeof roomAlertSchema>;
export type EnvironmentalReading = z.infer<typeof environmentalReadingSchema>;
export type MetrcSync = z.infer<typeof metrcSyncSchema>;
export type Site = z.infer<typeof siteSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
