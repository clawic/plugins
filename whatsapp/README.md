# WhatsApp Plugin

OpenClaw plugin for working with WhatsApp through the local `wacli` CLI.

It exposes real tools for operational messaging, history search, diagnostics, and backfill. It is not for normal back-and-forth chats with the user.

## Requirements

Install `wacli` locally, then authenticate once:

```bash
brew install steipete/tap/wacli
wacli auth
```

Keep sync running when you want continuous indexing:

```bash
wacli sync --follow
```

## Config

```json5
{
  plugins: {
    entries: {
      whatsapp: {
        enabled: true,
        config: {
          wacliPath: "/opt/homebrew/bin/wacli",
          storePath: "~/.wacli",
          requireExplicitSendConfirmation: true,
          defaultChatListLimit: 20,
          defaultMessageSearchLimit: 20,
        },
      },
    },
  },
}
```

`wacliPath` is optional if `wacli` is already on `PATH`.

## Tools

- `whatsapp_chats_list`
- `whatsapp_messages_search`
- `whatsapp_history_backfill`
- `whatsapp_doctor`
- `whatsapp_send_text`
- `whatsapp_send_file`

## Usage

After enabling `whatsapp`, ask for things like:

- Search my WhatsApp history for "invoice" after 2025-01-01.
- Find the JID for the Project Alpha group and backfill older messages.
- Send a WhatsApp message to +14155551212 saying that the files are ready.
- Send `/tmp/agenda.pdf` to the team group with caption "Agenda".

The send tools require `confirm=true` by default so the agent cannot send a real message without an explicit confirmation step.
