# Real Estate Plugin

Native OpenClaw plugin that adds local workflow management with:

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
openclaw plugins enable real-estate
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      "real-estate": {
        enabled: true,
        config: {
          storagePath: "~/.openclaw/state/real-estate/real-estate.json",
          defaultProject: "inbox",
          agendaHorizonDays: 7,
          autoArchiveCompletedDays: 30,
        },
      },
    },
  },
}
```

If `storagePath` is omitted, the plugin stores data in `~/.openclaw/state/real-estate/real-estate.json`.

## Tools

- `real_estate_create`
- `real_estate_list`
- `real_estate_update`
- `real_estate_complete`
- `real_estate_reopen`
- `real_estate_delete`
- `real_estate_note`
- `real_estate_agenda`
