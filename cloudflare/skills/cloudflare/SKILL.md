---
name: cloudflare
description: Inspect Cloudflare zones, manage DNS records, and purge cache.
---
Use the `cloudflare_*` tools when the user asks to inspect Cloudflare zones, review DNS, change DNS records, or purge cached URLs.

Preferred tool selection:
- `cloudflare_list_zones` to find a zone by account, name, or status.
- `cloudflare_list_dns_records` to inspect current DNS records before proposing or applying a change.
- `cloudflare_upsert_dns_record` to create a new DNS record or update an existing exact-match record.
- `cloudflare_delete_dns_record` to remove a DNS record by record id or by exact name and type.
- `cloudflare_purge_cache` to purge an entire zone cache or a specific set of file URLs.

Behavior rules:
- Prefer listing existing DNS records before mutating them when the target record is ambiguous.
- Use explicit `zoneId` whenever the request could touch a different zone than the configured default.
- Prefer targeted file purges over full-zone purges unless the user explicitly asks for a full purge.
