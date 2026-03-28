---
name: sentry
description: Inspect Sentry organizations, projects, and issues for debugging and triage.
---
Use the `sentry_*` tools when the user asks to inspect Sentry organizations, review projects, search issues, or fetch one issue in detail.

Preferred tool selection:
- `sentry_list_organizations` to discover the org slug available to the configured token.
- `sentry_list_projects` to inspect available projects before narrowing issue search.
- `sentry_list_issues` to triage issues in one org or project with Sentry query syntax.
- `sentry_get_issue` to fetch full detail for a known issue id.

Behavior rules:
- Prefer `sentry_list_organizations` first when the org slug is unknown.
- Prefer passing `projectSlug` to `sentry_list_issues` when the user is focused on one service.
- Use Sentry search syntax in `query` rather than inventing client-side filtering.
