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

Use the built-in `whatsapp_*` tools when the user explicitly asks to message someone else on WhatsApp or to sync or search WhatsApp history.
Do not use these tools for normal user chats.

Safety

- Require an explicit recipient and explicit message text before sending.
- Use `confirm=true` only after the user has explicitly confirmed the final recipient and content.
- If the recipient, group, file path, or message is ambiguous, ask a clarifying question.

Auth

- If WhatsApp is not linked yet, tell the user to run `wacli auth` manually because QR login is interactive.
- Use `whatsapp_doctor` to inspect the local setup and auth state.

Tools

- `whatsapp_chats_list` to find the correct chat JID before sending or backfilling.
- `whatsapp_messages_search` to search synced history by query, chat, and date range.
- `whatsapp_history_backfill` to request older messages for one chat.
- `whatsapp_send_text` to send a text message.
- `whatsapp_send_file` to send a file with an optional caption.

History backfill

- Backfill is best-effort and requires the primary phone to be online.
- Use `whatsapp_chats_list` first to verify the JID for groups.

Notes

- Default store directory is `~/.wacli` and can be overridden with `--store`.
- Direct chats look like `<number>@s.whatsapp.net`; groups look like `<id>@g.us`.
- If the user wants continuous background sync, tell them to run `wacli sync --follow` in their own terminal.
