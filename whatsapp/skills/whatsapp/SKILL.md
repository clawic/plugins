---
name: whatsapp
description: Send WhatsApp messages to other people or search and sync WhatsApp history via the local wacli CLI.
homepage: https://wacli.sh
metadata:
  {
    "openclaw":
      {
        "emoji": "💬",
        "requires": { "bins": ["wacli"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "steipete/tap/wacli",
              "bins": ["wacli"],
              "label": "Install wacli (brew)"
            },
            {
              "id": "go",
              "kind": "go",
              "module": "github.com/steipete/wacli/cmd/wacli@latest",
              "bins": ["wacli"],
              "label": "Install wacli (go)"
            }
          ]
      }
  }
---

# whatsapp

Use `wacli` only when the user explicitly asks to message someone else on WhatsApp or to sync or search WhatsApp history.
Do not use `wacli` for normal user chats.

Safety

- Require an explicit recipient and explicit message text before sending.
- Confirm the recipient and message before sending.
- If the recipient, group, file path, or message is ambiguous, ask a clarifying question.

Auth and sync

- `wacli auth`
- `wacli sync --follow`
- `wacli doctor`

Find chats and messages

- `wacli chats list --limit 20 --query "name or number"`
- `wacli messages search "query" --limit 20 --chat <jid>`
- `wacli messages search "invoice" --after 2025-01-01 --before 2025-12-31`

History backfill

- `wacli history backfill --chat <jid> --requests 2 --count 50`

Send

- Text: `wacli send text --to "+14155551212" --message "Hello! Are you free at 3pm?"`
- Group: `wacli send text --to "1234567890-123456789@g.us" --message "Running 5 min late."`
- File: `wacli send file --to "+14155551212" --file /path/agenda.pdf --caption "Agenda"`

Notes

- Default store directory is `~/.wacli` and can be overridden with `--store`.
- Use `--json` when the output needs to be parsed.
- Backfill is best-effort and requires the primary phone to be online.
- Direct chats look like `<number>@s.whatsapp.net`; groups look like `<id>@g.us`.
- Use `wacli chats list` to verify the correct JID before sending to a group.
