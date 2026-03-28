# Memory Plugin

Native OpenClaw plugin that adds local memory management with:

- memory capture, recall, retrieval, updates, reinforcement history, and deletion
- topics, tags, importance, pinning, and local JSON persistence
- search across summaries, details, and reinforced observations

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable memory
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      memory: {
        enabled: true,
        config: {
          storagePath: "~/.openclaw/state/memory/memory.json",
          defaultTopic: "general",
        },
      },
    },
  },
}
```

If `storagePath` is omitted, the plugin stores data in `~/.openclaw/state/memory/memory.json`.

## Tools

- `memory_remember`
- `memory_recall`
- `memory_get`
- `memory_update`
- `memory_reinforce`
- `memory_delete`
