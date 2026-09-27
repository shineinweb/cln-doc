/**
 * Canonical project status pipeline for the Agency AI Platform.
 *
 * New → Planning → Design → Development → Customer Review → Revision → QA → Launch → Maintenance
 */
export const PROJECT_STATUS_STAGES = [
  "NEW",
  "PLANNING",
  "DESIGN",
  "DEVELOPMENT",
  "CUSTOMER_REVIEW",
  "REVISION",
  "QA",
  "LAUNCH",
  "MAINTENANCE",
] as const;

export type ProjectStatusStage = (typeof PROJECT_STATUS_STAGES)[number];

export const PROJECT_STATUS_PIPELINE = [
  { status: "NEW", label: "New", description: "Project created; intake and kickoff pending." },
  { status: "PLANNING", label: "Planning", description: "Scope, timeline, and resourcing." },
  { status: "DESIGN", label: "Design", description: "UX/UI and creative production." },
  { status: "DEVELOPMENT", label: "Development", description: "Build and integration work." },
  {
    status: "CUSTOMER_REVIEW",
    label: "Customer Review",
    description: "Customer feedback on delivered work.",
  },
  { status: "REVISION", label: "Revision", description: "Address review feedback." },
  { status: "QA", label: "QA", description: "Quality assurance and acceptance checks." },
  { status: "LAUNCH", label: "Launch", description: "Go-live and cutover." },
  {
    status: "MAINTENANCE",
    label: "Maintenance",
    description: "Post-launch support and recurring care.",
  },
] as const;

export function isProjectStatusStage(value: string): value is ProjectStatusStage {
  return (PROJECT_STATUS_STAGES as readonly string[]).includes(value);
}

/**
 * Canonical project delivery hierarchy for the Agency AI Platform.
 *
 * Project → Milestone → Task → Subtask
 * (+ Comment, Attachment, TimeEntry, ProjectMember, ProjectActivity)
 */
export const PROJECT_DELIVERY_MODELS = [
  "Project",
  "Milestone",
  "Task",
  "Subtask",
  "Comment",
  "Attachment",
  "TimeEntry",
  "ProjectMember",
  "ProjectActivity",
] as const;

export type ProjectDeliveryModel = (typeof PROJECT_DELIVERY_MODELS)[number];

export const PROJECT_DELIVERY_HIERARCHY = [
  {
    model: "Project",
    label: "Project",
    description: "Delivery container scoped to an organization/customer.",
  },
  {
    model: "Milestone",
    label: "Milestone",
    description: "Phase or checkpoint within a project.",
  },
  {
    model: "Task",
    label: "Task",
    description: "Assignable work item, optionally under a milestone.",
  },
  {
    model: "Subtask",
    label: "Subtask",
    description: "Child work item under a task.",
  },
  {
    model: "Comment",
    label: "Comment",
    description: "Discussion on a project, task, or subtask.",
  },
  {
    model: "Attachment",
    label: "Attachment",
    description: "File metadata stored via StorageProvider.",
  },
  {
    model: "TimeEntry",
    label: "Time entry",
    description: "Billable or internal time logged against work.",
  },
  {
    model: "ProjectMember",
    label: "Project member",
    description: "Staff or client membership on a project.",
  },
  {
    model: "ProjectActivity",
    label: "Project activity",
    description: "Append-only activity feed for project events.",
  },
] as const;
