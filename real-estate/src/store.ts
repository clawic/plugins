import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AddNoteInput,
  AgendaInput,
  ChecklistItem,
  CompleteTaskInput,
  CreateTaskInput,
  DeleteTaskInput,
  ListTasksInput,
  RecurrenceFrequency,
  Task,
  TaskNote,
  TaskPluginConfig,
  TaskPriority,
  TaskRecurrence,
  TaskStoreFile,
  TaskView,
  UpdateChecklistInput,
  UpdateTaskInput,
} from "./types.js";

const DEFAULT_HORIZON_DAYS = 7;
const DEFAULT_AUTO_ARCHIVE_DAYS = 30;
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const EMPTY_STORE: TaskStoreFile = {
  version: 1,
  tasks: [],
};

export class TaskStore {
  private readonly storagePath: string;
  private readonly config: Required<Pick<TaskPluginConfig, "agendaHorizonDays" | "autoArchiveCompletedDays">> &
    TaskPluginConfig;

  constructor(config: TaskPluginConfig = {}) {
    this.storagePath = resolveStoragePath(config.storagePath);
    this.config = {
      ...config,
      agendaHorizonDays: config.agendaHorizonDays ?? DEFAULT_HORIZON_DAYS,
      autoArchiveCompletedDays: config.autoArchiveCompletedDays ?? DEFAULT_AUTO_ARCHIVE_DAYS,
    };
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    assertNonEmpty(input.title, "title");
    const now = new Date().toISOString();
    const store = await this.load();
    this.autoArchive(store.tasks);
    const task: Task = {
      id: createId("tsk"),
      title: input.title.trim(),
      description: normalizeOptionalString(input.description),
      status: "open",
      priority: input.priority ?? "medium",
      project: normalizeOptionalString(input.project ?? this.config.defaultProject),
      tags: normalizeTags(input.tags),
      dueAt: normalizeDateTime(input.dueAt, "dueAt"),
      scheduledFor: normalizeDateTime(input.scheduledFor, "scheduledFor"),
      estimateMinutes: normalizeOptionalNumber(input.estimateMinutes, "estimateMinutes"),
      checklist: normalizeChecklist(input.checklist, now),
      notes: [],
      recurrence: normalizeRecurrence(input.recurrence),
      createdAt: now,
      updatedAt: now,
    };
    store.tasks.push(task);
    await this.save(store);
    return task;
  }

  async listTasks(input: ListTasksInput = {}): Promise<Task[]> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const tasks = filterTasks(store.tasks, input);
    sortTasks(tasks);
    return tasks.slice(0, normalizeLimit(input.limit));
  }

  async updateTask(input: UpdateTaskInput): Promise<Task> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const task = findTask(store.tasks, input.taskId);
    const now = new Date().toISOString();

    if (input.title !== undefined) {
      assertNonEmpty(input.title, "title");
      task.title = input.title.trim();
    }
    if (input.description !== undefined) {
      task.description = normalizeOptionalString(input.description);
    }
    if (input.project !== undefined) {
      task.project = normalizeNullableString(input.project);
    }
    if (input.tags !== undefined) {
      task.tags = normalizeTags(input.tags);
    }
    if (input.addTags?.length) {
      task.tags = normalizeTags([...task.tags, ...input.addTags]);
    }
    if (input.removeTags?.length) {
      const remove = new Set(input.removeTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
      task.tags = task.tags.filter((tag) => !remove.has(tag.toLowerCase()));
    }
    if (input.priority !== undefined) {
      task.priority = input.priority;
    }
    if (input.dueAt !== undefined) {
      task.dueAt = normalizeNullableDateTime(input.dueAt, "dueAt");
    }
    if (input.scheduledFor !== undefined) {
      task.scheduledFor = normalizeNullableDateTime(input.scheduledFor, "scheduledFor");
    }
    if (input.estimateMinutes !== undefined) {
      task.estimateMinutes = normalizeNullableNumber(input.estimateMinutes, "estimateMinutes");
    }
    if (input.checklist !== undefined) {
      task.checklist = normalizeChecklist(input.checklist, now);
    }
    if (input.checklistUpdates?.length) {
      applyChecklistUpdates(task.checklist, input.checklistUpdates, now);
    }
    if (input.recurrence !== undefined) {
      task.recurrence = normalizeNullableRecurrence(input.recurrence);
    }

    task.updatedAt = now;
    await this.save(store);
    return task;
  }

  async completeTask(input: CompleteTaskInput): Promise<{ task: Task; spawnedTask?: Task }> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const task = findTask(store.tasks, input.taskId);
    const now = new Date().toISOString();

    task.status = "completed";
    task.completedAt = now;
    task.updatedAt = now;
    if (input.note) {
      task.notes.push(createNote(input.note, now));
    }

    let spawnedTask: Task | undefined;
    if (task.recurrence) {
      spawnedTask = spawnRecurringTask(task, now);
      store.tasks.push(spawnedTask);
    }

    await this.save(store);
    return { task, spawnedTask };
  }

  async reopenTask(taskId: string): Promise<Task> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const task = findTask(store.tasks, taskId);
    task.status = "open";
    task.completedAt = undefined;
    task.archivedAt = undefined;
    task.updatedAt = new Date().toISOString();
    await this.save(store);
    return task;
  }

  async deleteTask(input: DeleteTaskInput): Promise<{ taskId: string; deleted: "archived" | "removed" }> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const index = store.tasks.findIndex((task) => task.id === input.taskId);
    if (index === -1) {
      throw new Error(`Task not found: ${input.taskId}`);
    }

    if (input.hardDelete) {
      store.tasks.splice(index, 1);
      await this.save(store);
      return { taskId: input.taskId, deleted: "removed" };
    }

    const now = new Date().toISOString();
    store.tasks[index].status = "archived";
    store.tasks[index].archivedAt = now;
    store.tasks[index].updatedAt = now;
    await this.save(store);
    return { taskId: input.taskId, deleted: "archived" };
  }

  async addNote(input: AddNoteInput): Promise<Task> {
    assertNonEmpty(input.body, "body");
    const store = await this.load();
    this.autoArchive(store.tasks);
    const task = findTask(store.tasks, input.taskId);
    const now = new Date().toISOString();
    task.notes.push(createNote(input.body, now));
    task.updatedAt = now;
    await this.save(store);
    return task;
  }

  async agenda(input: AgendaInput = {}): Promise<{
    overdue: Task[];
    dueSoon: Task[];
    scheduled: Task[];
    backlog: Task[];
  }> {
    const store = await this.load();
    this.autoArchive(store.tasks);
    const now = new Date();
    const days = input.days ?? this.config.agendaHorizonDays;
    const limitDate = new Date(now);
    limitDate.setUTCDate(limitDate.getUTCDate() + days);

    const filtered = store.tasks.filter((task) => {
      if (!input.includeCompleted && task.status !== "open") {
        return false;
      }
      if (input.project && task.project !== input.project) {
        return false;
      }
      return true;
    });

    const overdue = filtered.filter((task) => isOverdue(task, now));
    const dueSoon = filtered.filter((task) => {
      if (!task.dueAt || task.status !== "open") {
        return false;
      }
      const due = new Date(task.dueAt);
      return due >= now && due <= limitDate;
    });
    const scheduled = filtered.filter((task) => {
      if (!task.scheduledFor || task.status !== "open") {
        return false;
      }
      const scheduledAt = new Date(task.scheduledFor);
      return scheduledAt >= now && scheduledAt <= limitDate;
    });
    const backlog = filtered.filter((task) => {
      return task.status === "open" && !task.dueAt && !task.scheduledFor;
    });

    sortTasks(overdue);
    sortTasks(dueSoon);
    sortTasks(scheduled);
    sortTasks(backlog);

    return { overdue, dueSoon, scheduled, backlog };
  }

  async inspectRaw(): Promise<TaskStoreFile> {
    return this.load();
  }

  private async load(): Promise<TaskStoreFile> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<TaskStoreFile>;
      return {
        version: 1,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      };
    } catch (error) {
      if (isNotFound(error)) {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async save(store: TaskStoreFile): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const tempPath = `${this.storagePath}.tmp`;
    const content = JSON.stringify(store, null, 2);
    await writeFile(tempPath, `${content}\n`, "utf8");
    await rename(tempPath, this.storagePath);
  }

  private autoArchive(tasks: Task[]): void {
    const threshold = new Date();
    threshold.setUTCDate(threshold.getUTCDate() - this.config.autoArchiveCompletedDays);
    const thresholdMs = threshold.getTime();
    for (const task of tasks) {
      if (task.status !== "completed" || !task.completedAt) {
        continue;
      }
      if (new Date(task.completedAt).getTime() <= thresholdMs) {
        task.status = "archived";
        task.archivedAt ??= new Date().toISOString();
      }
    }
  }
}

function applyChecklistUpdates(
  checklist: ChecklistItem[],
  updates: UpdateChecklistInput[],
  now: string,
): void {
  for (const update of updates) {
    const target = update.id
      ? checklist.find((item) => item.id === update.id)
      : update.label
        ? checklist.find((item) => item.label.toLowerCase() === update.label!.trim().toLowerCase())
        : undefined;

    if (!target) {
      throw new Error(`Checklist item not found for update: ${JSON.stringify(update)}`);
    }

    if (update.label !== undefined) {
      assertNonEmpty(update.label, "checklistUpdates.label");
      target.label = update.label.trim();
    }
    if (update.completed !== undefined) {
      target.completed = update.completed;
      target.completedAt = update.completed ? now : undefined;
    }
  }
}

function normalizeChecklist(items: string[] | undefined, now: string): ChecklistItem[] {
  if (!items) {
    return [];
  }
  return items.map((label) => {
    assertNonEmpty(label, "checklist item");
    return {
      id: createId("chk"),
      label: label.trim(),
      completed: false,
      completedAt: undefined,
    };
  });
}

function normalizeRecurrence(
  recurrence: Partial<TaskRecurrence> | undefined,
): TaskRecurrence | undefined {
  if (!recurrence) {
    return undefined;
  }
  return normalizeNullableRecurrence(recurrence);
}

function normalizeNullableRecurrence(
  recurrence: Partial<TaskRecurrence> | null,
): TaskRecurrence | undefined {
  if (!recurrence) {
    return undefined;
  }
  const frequency = recurrence.frequency;
  if (!frequency) {
    throw new Error("recurrence.frequency is required");
  }
  const allowed: RecurrenceFrequency[] = ["daily", "weekly", "monthly", "weekdays"];
  if (!allowed.includes(frequency)) {
    throw new Error(`Unsupported recurrence frequency: ${frequency}`);
  }
  const interval = recurrence.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) {
    throw new Error("recurrence.interval must be a positive integer");
  }
  return { frequency, interval };
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableString(value?: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  return normalizeOptionalString(value);
}

function normalizeDateTime(value: string | undefined, field: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} must be a valid ISO datetime`);
  }
  return date.toISOString();
}

function normalizeNullableDateTime(value: string | null, field: string): string | undefined {
  if (value === null) {
    return undefined;
  }
  return normalizeDateTime(value, field);
}

function normalizeOptionalNumber(value: number | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`);
  }
  return value;
}

function normalizeNullableNumber(value: number | null, field: string): number | undefined {
  if (value === null) {
    return undefined;
  }
  return normalizeOptionalNumber(value, field);
}

function resolveStoragePath(customPath?: string): string {
  if (!customPath) {
    return path.join(os.homedir(), ".openclaw", "state", "real-estate", "real-estate.json");
  }
  if (customPath.startsWith("~")) {
    return path.join(os.homedir(), customPath.slice(1));
  }
  return path.resolve(customPath);
}

function filterTasks(tasks: Task[], input: ListTasksInput): Task[] {
  const now = new Date();
  const dueBefore = input.dueBefore ? new Date(input.dueBefore) : undefined;
  const dueAfter = input.dueAfter ? new Date(input.dueAfter) : undefined;
  const view = input.view ?? "all";
  const status = input.status ?? "all";
  const query = input.search?.trim().toLowerCase();

  return tasks.filter((task) => {
    if (!input.includeArchived && task.status === "archived") {
      return false;
    }
    if (status !== "all" && task.status !== status) {
      return false;
    }
    if (!matchesView(task, view, now)) {
      return false;
    }
    if (input.project && task.project !== input.project) {
      return false;
    }
    if (input.tag && !task.tags.includes(input.tag)) {
      return false;
    }
    if (input.priority && task.priority !== input.priority) {
      return false;
    }
    if (query) {
      const haystack = [
        task.title,
        task.description,
        task.project,
        ...task.tags,
        ...task.notes.map((note) => note.body),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    if (dueBefore && (!task.dueAt || new Date(task.dueAt) > dueBefore)) {
      return false;
    }
    if (dueAfter && (!task.dueAt || new Date(task.dueAt) < dueAfter)) {
      return false;
    }
    return true;
  });
}

function matchesView(task: Task, view: TaskView, now: Date): boolean {
  switch (view) {
    case "all":
      return true;
    case "completed":
      return task.status === "completed";
    case "overdue":
      return isOverdue(task, now);
    case "backlog":
      return task.status === "open" && !task.dueAt && !task.scheduledFor;
    case "today":
      return isTodayTask(task, now);
    case "upcoming": {
      if (task.status !== "open" || !task.dueAt) {
        return false;
      }
      const due = new Date(task.dueAt);
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(23, 59, 59, 999);
      return due > tomorrow;
    }
  }
}

function isTodayTask(task: Task, now: Date): boolean {
  if (task.status !== "open") {
    return false;
  }
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);

  return [task.dueAt, task.scheduledFor]
    .filter(Boolean)
    .some((value) => {
      const date = new Date(value as string);
      return date >= start && date <= end;
    });
}

function isOverdue(task: Task, now: Date): boolean {
  if (task.status !== "open" || !task.dueAt) {
    return false;
  }
  return new Date(task.dueAt) < now;
}

function sortTasks(tasks: Task[]): void {
  tasks.sort((left, right) => {
    const leftDue = left.dueAt ?? left.scheduledFor ?? left.updatedAt;
    const rightDue = right.dueAt ?? right.scheduledFor ?? right.updatedAt;
    const dateDiff = new Date(leftDue).getTime() - new Date(rightDue).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    const priorityDiff = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.title.localeCompare(right.title);
  });
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) {
    return 25;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be a positive integer");
  }
  return limit;
}

function findTask(tasks: Task[], taskId: string): Task {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  return task;
}

function createNote(body: string, createdAt: string): TaskNote {
  assertNonEmpty(body, "note body");
  return {
    id: createId("note"),
    body: body.trim(),
    createdAt,
  };
}

function spawnRecurringTask(task: Task, now: string): Task {
  const baseDate = task.dueAt ?? task.scheduledFor ?? now;
  const nextDueAt = task.dueAt ? shiftDate(baseDate, task.recurrence!) : undefined;
  const nextScheduledFor = task.scheduledFor ? shiftDate(baseDate, task.recurrence!) : undefined;

  return {
    ...task,
    id: createId("tsk"),
    status: "open",
    completedAt: undefined,
    archivedAt: undefined,
    dueAt: nextDueAt,
    scheduledFor: nextScheduledFor,
    checklist: task.checklist.map((item) => ({
      ...item,
      id: createId("chk"),
      completed: false,
      completedAt: undefined,
    })),
    notes: [],
    createdAt: now,
    updatedAt: now,
    sourceTaskId: task.id,
  };
}

function shiftDate(isoDate: string, recurrence: TaskRecurrence): string {
  const date = new Date(isoDate);
  switch (recurrence.frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + recurrence.interval);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7 * recurrence.interval);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + recurrence.interval);
      break;
    case "weekdays": {
      let remaining = recurrence.interval;
      while (remaining > 0) {
        date.setUTCDate(date.getUTCDate() + 1);
        const day = date.getUTCDay();
        if (day !== 0 && day !== 6) {
          remaining -= 1;
        }
      }
      break;
    }
  }
  return date.toISOString();
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
