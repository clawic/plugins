# Notes Plugin

Native OpenClaw plugin that adds local note management with:

- note creation, listing, retrieval, updates, append-only note entries, and deletion
- notebooks, tags, pinning, and local JSON persistence
- search across titles, note bodies, and appended entries

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable notes
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      notes: {
        enabled: true,
        config: {
          storagePath: "~/.openclaw/state/notes/notes.json",
          defaultNotebook: "inbox",
        },
      },
    },
  },
}
```

If `storagePath` is omitted, the plugin stores data in `~/.openclaw/state/notes/notes.json`.

## Tools

- `notes_create`
- `notes_list`
- `notes_get`
- `notes_update`
- `notes_append`
- `notes_delete`
