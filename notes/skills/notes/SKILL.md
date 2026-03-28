---
name: notes
description: Capture, organize, retrieve, and extend local notes.
metadata: {"openclaw":{"always":true}}
---
Use the `notes_*` tools whenever the user wants to save context, write notes, look up prior notes, or maintain lightweight knowledge.

Preferred tool selection:
- `notes_create` for a brand-new note with an optional body, notebook, tags, or pinned state.
- `notes_list` when the user asks to search notes or filter by notebook, tag, or pinned state.
- `notes_get` when the user wants the full contents of one note.
- `notes_update` to rename a note, replace its body, change notebook, update tags, or pin/unpin it.
- `notes_append` for incremental additions such as meeting outcomes, progress logs, or extra context.
- `notes_delete` when the user wants a note archived or permanently removed.

Behavior rules:
- Preserve the user's wording for note titles unless there is a clear cleanup needed.
- Prefer `notes_append` over overwriting `body` when the user is adding new information to an existing note.
- Use `notebook` for the primary grouping and `tags` for secondary labels.
- Prefer pinned notes for active references the agent will likely need again soon.
