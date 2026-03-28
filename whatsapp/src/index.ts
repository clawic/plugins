import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const execFileAsync = promisify(execFile);
const DEFAULT_CHAT_LIST_LIMIT = 20;
const DEFAULT_MESSAGE_SEARCH_LIMIT = 20;

type PluginConfig = {
  wacliPath?: string;
  storePath?: string;
  requireExplicitSendConfirmation?: boolean;
  defaultChatListLimit?: number;
  defaultMessageSearchLimit?: number;
};

type JsonRecord = Record<string, unknown>;

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

function pickString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function ensureArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalizeConfig(input: Record<string, unknown>) {
  const config: PluginConfig = {};

  if (typeof input.wacliPath === "string" && input.wacliPath.trim()) {
    config.wacliPath = input.wacliPath.trim();
  }
  if (typeof input.storePath === "string" && input.storePath.trim()) {
    config.storePath = input.storePath.trim();
  }
  if (typeof input.requireExplicitSendConfirmation === "boolean") {
    config.requireExplicitSendConfirmation = input.requireExplicitSendConfirmation;
  }
  if (typeof input.defaultChatListLimit === "number") {
    config.defaultChatListLimit = input.defaultChatListLimit;
  }
  if (typeof input.defaultMessageSearchLimit === "number") {
    config.defaultMessageSearchLimit = input.defaultMessageSearchLimit;
  }

  return config;
}

function baseArgs(config: PluginConfig, json: boolean) {
  const args: string[] = [];
  if (config.storePath) {
    args.push("--store", config.storePath);
  }
  if (json) {
    args.push("--json");
  }
  return args;
}

async function runWacli(config: PluginConfig, args: string[], options: { json?: boolean } = {}) {
  const command = config.wacliPath ?? "wacli";
  const commandArgs = [...baseArgs(config, Boolean(options.json)), ...args];
  const { stdout, stderr } = await execFileAsync(command, commandArgs, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });

  const text = stdout.trim();
  const parsed = options.json && text ? JSON.parse(text) : undefined;

  return {
    command,
    commandArgs,
    stdout: text,
    stderr: stderr.trim(),
    parsed,
  };
}

function formatChatList(chats: unknown) {
  const entries = ensureArray(chats).filter((value): value is JsonRecord => !!value && typeof value === "object");
  if (!entries.length) return "No WhatsApp chats found.";

  return [
    "WhatsApp chats",
    ...entries.map((chat, index) => {
      const name =
        pickString(chat, ["Name", "name", "DisplayName", "displayName", "PushName", "pushName"]) ??
        "Unnamed chat";
      const jid = pickString(chat, ["JID", "jid", "ChatJID", "chatJid"]) ?? "unknown";
      const unread = pickNumber(chat, ["UnreadCount", "unreadCount"]);
      return `${index + 1}. ${name} (${jid})${typeof unread === "number" ? ` unread:${unread}` : ""}`;
    }),
  ].join("\n");
}

function formatMessageList(messages: unknown) {
  const entries = ensureArray(messages).filter((value): value is JsonRecord => !!value && typeof value === "object");
  if (!entries.length) return "No WhatsApp messages matched the search.";

  return [
    "Matching WhatsApp messages",
    ...entries.map((message, index) => {
      const chat = pickString(message, ["ChatJID", "chatJid", "JID", "jid"]) ?? "unknown-chat";
      const sender =
        pickString(message, ["Sender", "sender", "SenderName", "senderName", "Author", "author"]) ??
        "unknown";
      const body =
        pickString(message, ["Text", "text", "Body", "body", "Message", "message", "DisplayText"]) ??
        "(no text)";
      const timestamp =
        pickString(message, ["Timestamp", "timestamp", "CreatedAt", "createdAt", "Time", "time"]) ?? "";
      return `${index + 1}. [${chat}] ${sender}${timestamp ? ` @ ${timestamp}` : ""}: ${body}`;
    }),
  ].join("\n");
}

function ensureSendConfirmed(config: PluginConfig, confirm: boolean | undefined) {
  if (config.requireExplicitSendConfirmation === false) return;
  if (confirm) return;
  throw new Error("This tool sends a real WhatsApp message. Retry with confirm=true after verifying the target.");
}

export default definePluginEntry({
  id: "whatsapp",
  name: "WhatsApp",
  description: "Search chats, backfill history, run diagnostics, and send WhatsApp messages through wacli",
  register(api) {
    const config = normalizeConfig((api.pluginConfig ?? {}) as Record<string, unknown>);

    api.registerTool({
      name: "whatsapp_chats_list",
      label: "List WhatsApp chats",
      description: "List WhatsApp chats from the local wacli store, optionally filtered by name or number",
      parameters: Type.Object({
        query: Type.Optional(Type.String({ minLength: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const result = await runWacli(
          config,
          [
            "chats",
            "list",
            "--limit",
            String(params.limit ?? config.defaultChatListLimit ?? DEFAULT_CHAT_LIST_LIMIT),
            ...(params.query ? ["--query", params.query] : []),
          ],
          { json: true },
        );

        const chats = ensureArray(result.parsed);
        return toolTextResult(formatChatList(chats), {
          status: "ok",
          count: chats.length,
          chats,
          command: [result.command, ...result.commandArgs],
        });
      },
    });

    api.registerTool({
      name: "whatsapp_messages_search",
      label: "Search WhatsApp messages",
      description: "Search synced WhatsApp messages by query, chat JID, or date range",
      parameters: Type.Object({
        query: Type.String({ minLength: 1 }),
        chat: Type.Optional(Type.String({ minLength: 1 })),
        after: Type.Optional(Type.String({ minLength: 1 })),
        before: Type.Optional(Type.String({ minLength: 1 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const result = await runWacli(
          config,
          [
            "messages",
            "search",
            params.query,
            "--limit",
            String(params.limit ?? config.defaultMessageSearchLimit ?? DEFAULT_MESSAGE_SEARCH_LIMIT),
            ...(params.chat ? ["--chat", params.chat] : []),
            ...(params.after ? ["--after", params.after] : []),
            ...(params.before ? ["--before", params.before] : []),
          ],
          { json: true },
        );

        const messages = ensureArray(result.parsed);
        return toolTextResult(formatMessageList(messages), {
          status: "ok",
          count: messages.length,
          messages,
          command: [result.command, ...result.commandArgs],
        });
      },
    });

    api.registerTool({
      name: "whatsapp_history_backfill",
      label: "Backfill WhatsApp history",
      description: "Request best-effort historical message sync for one chat from the linked phone",
      parameters: Type.Object({
        chat: Type.String({ minLength: 1 }),
        requests: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
        count: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
      }),
      async execute(_id, params) {
        const result = await runWacli(config, [
          "history",
          "backfill",
          "--chat",
          params.chat,
          "--requests",
          String(params.requests ?? 2),
          "--count",
          String(params.count ?? 50),
        ]);

        return toolTextResult(
          [`History backfill requested for ${params.chat}.`, result.stdout].filter(Boolean).join("\n"),
          {
            status: "ok",
            chat: params.chat,
            stdout: result.stdout,
            command: [result.command, ...result.commandArgs],
          },
        );
      },
    });

    api.registerTool({
      name: "whatsapp_doctor",
      label: "Run WhatsApp diagnostics",
      description: "Run wacli doctor to inspect local WhatsApp CLI setup and auth state",
      parameters: Type.Object({}, { additionalProperties: false }),
      async execute() {
        const result = await runWacli(config, ["doctor"]);
        return toolTextResult(result.stdout || "wacli doctor completed.", {
          status: "ok",
          stdout: result.stdout,
          command: [result.command, ...result.commandArgs],
        });
      },
    });

    api.registerTool({
      name: "whatsapp_send_text",
      label: "Send WhatsApp text",
      description: "Send a WhatsApp text message to a verified phone number or chat JID",
      parameters: Type.Object({
        to: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 }),
        confirm: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        ensureSendConfirmed(config, params.confirm);
        const result = await runWacli(config, [
          "send",
          "text",
          "--to",
          params.to,
          "--message",
          params.message,
        ]);

        return toolTextResult(result.stdout || `WhatsApp text sent to ${params.to}.`, {
          status: "sent",
          to: params.to,
          mode: "text",
          stdout: result.stdout,
          command: [result.command, ...result.commandArgs],
        });
      },
    });

    api.registerTool({
      name: "whatsapp_send_file",
      label: "Send WhatsApp file",
      description: "Send a file to a WhatsApp phone number or chat JID with an optional caption",
      parameters: Type.Object({
        to: Type.String({ minLength: 1 }),
        file: Type.String({ minLength: 1 }),
        caption: Type.Optional(Type.String()),
        filename: Type.Optional(Type.String()),
        confirm: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        ensureSendConfirmed(config, params.confirm);
        const result = await runWacli(config, [
          "send",
          "file",
          "--to",
          params.to,
          "--file",
          params.file,
          ...(params.caption ? ["--caption", params.caption] : []),
          ...(params.filename ? ["--filename", params.filename] : []),
        ]);

        return toolTextResult(result.stdout || `WhatsApp file sent to ${params.to}.`, {
          status: "sent",
          to: params.to,
          mode: "file",
          file: params.file,
          stdout: result.stdout,
          command: [result.command, ...result.commandArgs],
        });
      },
    });
  },
});
