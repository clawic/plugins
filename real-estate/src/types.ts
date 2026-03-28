export type TaskStatus = "open" | "completed" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskView =
  | "all"
  | "today"
  | "upcoming"
  | "overdue"
  | "backlog"
  | "completed";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "weekdays";

export interface TaskRecurrence {
  frequency: RecurrenceFrequency;
  interval: number;
}

export interface TaskNote {
  id: string;
  body: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  project?: string;
  tags: string[];
  dueAt?: string;
  scheduledFor?: string;
  estimateMinutes?: number;
  checklist: ChecklistItem[];
  notes: TaskNote[];
  recurrence?: TaskRecurrence;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  sourceTaskId?: string;
}

export interface TaskStoreFile {
  version: 1;
  tasks: Task[];
}

export interface TaskPluginConfig {
  storagePath?: string;
  defaultProject?: string;
  agendaHorizonDays?: number;
  autoArchiveCompletedDays?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  project?: string;
  tags?: string[];
  priority?: TaskPriority;
  dueAt?: string;
  scheduledFor?: string;
  estimateMinutes?: number;
  checklist?: string[];
  recurrence?: Partial<TaskRecurrence>;
}

export interface UpdateChecklistInput {
  id?: string;
  label?: string;
  completed?: boolean;
}

export interface UpdateTaskInput {
  taskId: string;
  title?: string;
  description?: string;
  project?: string | null;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  priority?: TaskPriority;
  dueAt?: string | null;
  scheduledFor?: string | null;
  estimateMinutes?: number | null;
  checklist?: string[];
  checklistUpdates?: UpdateChecklistInput[];
  recurrence?: Partial<TaskRecurrence> | null;
}

export interface ListTasksInput {
  view?: TaskView;
  status?: TaskStatus | "all";
  project?: string;
  tag?: string;
  priority?: TaskPriority;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface CompleteTaskInput {
  taskId: string;
  note?: string;
}

export interface DeleteTaskInput {
  taskId: string;
  hardDelete?: boolean;
}

export interface AgendaInput {
  days?: number;
  project?: string;
  includeCompleted?: boolean;
}

export interface AddNoteInput {
  taskId: string;
  body: string;
}
