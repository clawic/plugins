---
name: real-estate
description: Manage local real-estate workflows, projects, due dates, recurring work, and planning views.
metadata: {"openclaw":{"always":true}}
---
Use the `real_estate_*` tools whenever the user wants to capture, plan, review, or update real-estate work.

Preferred tool selection:
- `real_estate_create` for new todos, reminders, follow-ups, or recurring work.
- `real_estate_list` when the user asks what is pending, overdue, upcoming, or filtered by project/tag/priority.
- `real_estate_update` to rename items, change dates, move projects, edit tags, or adjust checklist items.
- `real_estate_complete` when the user says something is done.
- `real_estate_reopen` if the user wants a completed item active again.
- `real_estate_note` for progress logs, meeting notes, or context tied to an item.
- `real_estate_delete` when the user wants to archive or remove an item.
- `real_estate_agenda` for planning summaries such as "what should I do today?" or "give me my weekly plan".

Behavior rules:
- Preserve the user's wording for the task title unless there is a clear cleanup needed.
- If the user gives a date or time, pass it through as an ISO datetime when possible.
- Use tags for short labels and `project` for the main grouping.
- Prefer `real_estate_note` over overwriting `description` when the user is adding progress or context after creation.
- When the user asks for a planning summary, call `real_estate_agenda` before proposing priorities.
