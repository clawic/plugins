---
name: google
description: Route web_search through Google results via SerpApi.
---
Use `web_search` when the user needs current web results and the Google provider is enabled.

Behavior rules:
- Prefer `web_search` for factual, recent, or source-backed lookups.
- Pass `country`, `language`, or `location` only when the user asked for regionalized results.
- Use `site` when the user wants results constrained to one domain.
