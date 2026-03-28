---
name: tasks
description: Manage local tasks, projects, due dates, recurring work, and planning views.
metadata: {"openclaw":{"always":true}}
---
Use the `tasks_*` tools whenever the user wants to capture, plan, review, or update work.

Preferred tool selection:
- `tasks_create` for new todos, reminders, follow-ups, or recurring work.
- `tasks_list` when the user asks what is pending, overdue, upcoming, or filtered by project/tag/priority.
- `tasks_update` to rename tasks, change dates, move projects, edit tags, or adjust checklist items.
- `tasks_complete` when the user says something is done.
- `tasks_reopen` if the user wants a completed task active again.
- `tasks_note` for progress logs, meeting notes, or context tied to a task.
- `tasks_delete` when the user wants to archive or remove a task.
- `tasks_agenda` for planning summaries such as "what should I do today?" or "give me my weekly plan".

Behavior rules:
- Preserve the user's wording for the task title unless there is a clear cleanup needed.
- If the user gives a date or time, pass it through as an ISO datetime when possible.
- Use tags for short labels and `project` for the main grouping.
- Prefer `tasks_note` over overwriting `description` when the user is adding progress or context after creation.
- When the user asks for a planning summary, call `tasks_agenda` before proposing priorities.
