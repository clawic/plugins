---
name: memory
description: Capture, organize, recall, and reinforce local memories.
metadata: {"openclaw":{"always":true}}
---
Use the `memory_*` tools whenever the user wants to save durable context, recall prior facts, or maintain lightweight local memory.

Preferred tool selection:
- `memory_remember` for a brand-new memory with an optional details block, topic, tags, importance, or pinned state.
- `memory_recall` when the user asks to search memories or filter by topic, tag, importance, or pinned state.
- `memory_get` when the user wants the full contents of one memory.
- `memory_update` to rewrite a memory summary, replace details, change topic, update tags, adjust importance, or pin/unpin it.
- `memory_reinforce` for incremental additions such as confirmations, outcomes, or extra context tied to an existing memory.
- `memory_delete` when the user wants a memory archived or permanently removed.

Behavior rules:
- Preserve the user's wording for the memory summary unless there is a clear cleanup needed.
- Prefer `memory_reinforce` over overwriting `details` when the user is adding new evidence or confirmation.
- Use `topic` for the primary grouping and `tags` for secondary labels.
- Prefer pinned memories for references the agent will likely need again soon.
