import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { formatTask, formatTaskList } from "./format.js";
import { TaskStore } from "./store.js";

const recurrenceSchema = Type.Optional(
  Type.Object({
    frequency: Type.Union([
      Type.Literal("daily"),
      Type.Literal("weekly"),
      Type.Literal("monthly"),
      Type.Literal("weekdays"),
    ]),
    interval: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
);

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export default definePluginEntry({
  id: "real-estate",
  name: "Real Estate",
  description: "Manage local workflows, projects, priorities, and recurring work inside OpenClaw",
  register(api) {
    const store = new TaskStore(api.pluginConfig ?? {});

    api.registerTool({
      name: "real_estate_create",
      label: "Create task",
      description: "Create a task with title, scheduling details, tags, checklist items, and recurrence",
      parameters: Type.Object({
        title: Type.String({ minLength: 1 }),
        description: Type.Optional(Type.String()),
        project: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        priority: Type.Optional(
          Type.Union([
            Type.Literal("low"),
            Type.Literal("medium"),
            Type.Literal("high"),
            Type.Literal("urgent"),
          ]),
        ),
        dueAt: Type.Optional(Type.String()),
        scheduledFor: Type.Optional(Type.String()),
        estimateMinutes: Type.Optional(Type.Number({ minimum: 0 })),
        checklist: Type.Optional(Type.Array(Type.String())),
        recurrence: recurrenceSchema,
      }),
      async execute(_id, params) {
        const task = await store.createTask(params);
        return toolTextResult(`Task created.\n${formatTask(task)}`, {
          status: "created",
          task,
        });
      },
    });

    api.registerTool({
      name: "real_estate_list",
      label: "List workflows",
      description: "List workflow items by view, status, project, tag, priority, due window, or search query",
      parameters: Type.Object({
        view: Type.Optional(
          Type.Union([
            Type.Literal("all"),
            Type.Literal("today"),
            Type.Literal("upcoming"),
            Type.Literal("overdue"),
            Type.Literal("backlog"),
            Type.Literal("completed"),
          ]),
        ),
        status: Type.Optional(
          Type.Union([
            Type.Literal("open"),
            Type.Literal("completed"),
            Type.Literal("archived"),
            Type.Literal("all"),
          ]),
        ),
        project: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        priority: Type.Optional(
          Type.Union([
            Type.Literal("low"),
            Type.Literal("medium"),
            Type.Literal("high"),
            Type.Literal("urgent"),
          ]),
        ),
        search: Type.Optional(Type.String()),
        dueBefore: Type.Optional(Type.String()),
        dueAfter: Type.Optional(Type.String()),
        includeArchived: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const tasks = await store.listTasks(params);
        return toolTextResult(formatTaskList("Matching records", tasks), {
          status: "ok",
          count: tasks.length,
          tasks,
        });
      },
    });

    api.registerTool({
      name: "real_estate_update",
      label: "Update task",
      description: "Update task fields including title, due date, project, tags, recurrence, and checklist state",
      parameters: Type.Object({
        taskId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        project: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String())),
        addTags: Type.Optional(Type.Array(Type.String())),
        removeTags: Type.Optional(Type.Array(Type.String())),
        priority: Type.Optional(
          Type.Union([
            Type.Literal("low"),
            Type.Literal("medium"),
            Type.Literal("high"),
            Type.Literal("urgent"),
          ]),
        ),
        dueAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        scheduledFor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        estimateMinutes: Type.Optional(Type.Union([Type.Number({ minimum: 0 }), Type.Null()])),
        checklist: Type.Optional(Type.Array(Type.String())),
        checklistUpdates: Type.Optional(
          Type.Array(
            Type.Object({
              id: Type.Optional(Type.String()),
              label: Type.Optional(Type.String()),
              completed: Type.Optional(Type.Boolean()),
            }),
          ),
        ),
        recurrence: Type.Optional(Type.Union([recurrenceSchema, Type.Null()])),
      }),
      async execute(_id, params) {
        const task = await store.updateTask(params);
        return toolTextResult(`Task updated.\n${formatTask(task)}`, {
          status: "updated",
          task,
        });
      },
    });

    api.registerTool({
      name: "real_estate_complete",
      label: "Complete task",
      description: "Mark a task as complete and roll the next instance when the task is recurring",
      parameters: Type.Object({
        taskId: Type.String({ minLength: 1 }),
        note: Type.Optional(Type.String()),
      }),
      async execute(_id, params) {
        const { task, spawnedTask } = await store.completeTask(params);
        const extra = spawnedTask ? `\nNext recurring task:\n${formatTask(spawnedTask)}` : "";
        return toolTextResult(`Task completed.\n${formatTask(task)}${extra}`, {
          status: "completed",
          task,
          spawnedTask,
        });
      },
    });

    api.registerTool({
      name: "real_estate_reopen",
      label: "Reopen task",
      description: "Reopen a completed or archived task",
      parameters: Type.Object({
        taskId: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const task = await store.reopenTask(params.taskId);
        return toolTextResult(`Task reopened.\n${formatTask(task)}`, {
          status: "reopened",
          task,
        });
      },
    });

    api.registerTool({
      name: "real_estate_delete",
      label: "Delete task",
      description: "Archive a task by default, or remove it permanently when hardDelete is true",
      parameters: Type.Object({
        taskId: Type.String({ minLength: 1 }),
        hardDelete: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const result = await store.deleteTask(params);
        return toolTextResult(
          `Task ${result.deleted === "removed" ? "deleted permanently" : "archived"}: ${result.taskId}`,
          { status: result.deleted, taskId: result.taskId },
        );
      },
    });

    api.registerTool({
      name: "real_estate_note",
      label: "Add task note",
      description: "Append a note or progress update to an existing task",
      parameters: Type.Object({
        taskId: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const task = await store.addNote(params);
        return toolTextResult(`Note added.\n${formatTask(task)}`, {
          status: "noted",
          task,
        });
      },
    });

    api.registerTool({
      name: "real_estate_agenda",
      label: "Workflow agenda",
      description: "Summarize overdue, due soon, scheduled, and backlog items for planning",
      parameters: Type.Object({
        days: Type.Optional(Type.Integer({ minimum: 1, maximum: 365 })),
        project: Type.Optional(Type.String()),
        includeCompleted: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const agenda = await store.agenda(params);
        return toolTextResult(
          [
            formatTaskList("Overdue", agenda.overdue),
            formatTaskList("Due soon", agenda.dueSoon),
            formatTaskList("Scheduled", agenda.scheduled),
            formatTaskList("Backlog", agenda.backlog),
          ].join("\n\n"),
          {
            status: "ok",
            agenda,
          },
        );
      },
    });
  },
});
