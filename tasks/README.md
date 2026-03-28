# Tasks Plugin

Native OpenClaw plugin that adds local task management with:

- task creation, listing, updates, completion, reopening, and deletion
- projects, tags, priorities, due dates, scheduling, and estimates
- checklist items and task notes
- recurring tasks with automatic next-instance creation
- agenda views for overdue, due soon, scheduled, and backlog work

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable tasks
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      tasks: {
        enabled: true,
        config: {
          storagePath: "~/.openclaw/state/tasks/tasks.json",
          defaultProject: "inbox",
          agendaHorizonDays: 7,
          autoArchiveCompletedDays: 30,
        },
      },
    },
  },
}
```

If `storagePath` is omitted, the plugin stores data in `~/.openclaw/state/tasks/tasks.json`.

## Tools

- `tasks_create`
- `tasks_list`
- `tasks_update`
- `tasks_complete`
- `tasks_reopen`
- `tasks_delete`
- `tasks_note`
- `tasks_agenda`
