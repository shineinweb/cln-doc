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
