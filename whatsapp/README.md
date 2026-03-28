# WhatsApp Plugin

Skill-first OpenClaw plugin for sending third-party WhatsApp messages and searching synced history through the local `wacli` CLI.

It is meant for operational messaging, history search, and sync tasks. It is not for normal back-and-forth chats with the user.

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

## Usage

After enabling `whatsapp`, ask for things like:

- Search my WhatsApp history for "invoice" after 2025-01-01.
- Find the JID for the Project Alpha group and backfill older messages.
- Send a WhatsApp message to +14155551212 saying that the files are ready.
- Send `/tmp/agenda.pdf` to the team group with caption "Agenda".

The skill works best when the request includes an explicit recipient, exact message text, and a verified chat or phone number.
