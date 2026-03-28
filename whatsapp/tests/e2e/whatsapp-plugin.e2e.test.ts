import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import plugin from "../../src/index.js";

const execFileAsync = promisify(execFile);

function createHarness(pluginConfig: Record<string, unknown> = {}) {
  const registeredTools = new Map<string, any>();

  plugin.register({
    id: "whatsapp",
    name: "WhatsApp",
    source: import.meta.dirname,
    registrationMode: "full",
    config: {},
    pluginConfig,
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    registerTool(value: any) {
      registeredTools.set(value.name, value);
    },
  } as any);

  return registeredTools;
}

function createFakeWacli() {
  const fixtureDir = mkdtempSync(path.join(os.tmpdir(), "whatsapp-plugin-"));
  const scriptPath = path.join(fixtureDir, "fake-wacli.mjs");
  const logPath = path.join(fixtureDir, "calls.log");
  const storePath = path.join(fixtureDir, "store");

  mkdirSync(storePath, { recursive: true });
  writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
import { appendFileSync } from "node:fs";

let args = process.argv.slice(2);
if (args[0] === "--store") {
  args = args.slice(2);
}
const json = args[0] === "--json";
if (json) {
  args = args.slice(1);
}

appendFileSync(${JSON.stringify(logPath)}, JSON.stringify({ json, args }) + "\\n");

if (args[0] === "chats" && args[1] === "list") {
  process.stdout.write(JSON.stringify([
    { JID: "1234567890-123456789@g.us", Name: "Project Alpha", UnreadCount: 4 },
    { JID: "14155551212@s.whatsapp.net", Name: "Alice" }
  ]));
  process.exit(0);
}

if (args[0] === "messages" && args[1] === "search") {
  process.stdout.write(JSON.stringify([
    {
      ChatJID: "1234567890-123456789@g.us",
      MessageID: "msg-1",
      Sender: "Alice",
      Text: "Result for " + args[2],
      Timestamp: "2026-03-01T10:00:00Z"
    }
  ]));
  process.exit(0);
}

if (args[0] === "history" && args[1] === "backfill") {
  process.stdout.write("backfill queued for " + args[3]);
  process.exit(0);
}

if (args[0] === "doctor") {
  process.stdout.write("doctor ok");
  process.exit(0);
}

if (args[0] === "send" && args[1] === "text") {
  process.stdout.write("sent text to " + args[3]);
  process.exit(0);
}

if (args[0] === "send" && args[1] === "file") {
  process.stdout.write("sent file to " + args[3]);
  process.exit(0);
}

process.stderr.write("unexpected args: " + JSON.stringify(args));
process.exit(1);
`,
  );
  chmodSync(scriptPath, 0o755);

  return {
    scriptPath,
    logPath,
    storePath,
  };
}

describe("whatsapp plugin e2e", () => {
  it("ships the publish metadata and wacli skill surface required by clawhub", async () => {
    const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
    const manifestPath = path.resolve(import.meta.dirname, "../../openclaw.plugin.json");
    const skillPath = path.resolve(import.meta.dirname, "../../skills/whatsapp/SKILL.md");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      name: string;
      version: string;
      openclaw?: {
        compat?: {
          pluginApi?: string;
        };
        build?: {
          openclawVersion?: string;
        };
      };
    };
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      id: string;
      version?: string;
      skills?: string[];
    };
    const skill = await readFile(skillPath, "utf8");

    expect(packageJson.name).toBe("whatsapp");
    expect(manifest.id).toBe("whatsapp");
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.skills).toEqual(["skills/whatsapp"]);
    expect(packageJson.openclaw?.compat?.pluginApi).toBe(">=2026.3.23");
    expect(packageJson.openclaw?.build?.openclawVersion).toBe("2026.3.23-2");
    expect(skill).toContain('"requires": { "bins": ["wacli"] }');
    expect(skill).toContain("whatsapp_send_text");
    expect(skill).toContain("wacli auth");
  });

  it("registers whatsapp tools and shells out to wacli with explicit send confirmation", async () => {
    const fakeWacli = createFakeWacli();
    const tools = createHarness({
      wacliPath: fakeWacli.scriptPath,
      storePath: fakeWacli.storePath,
      requireExplicitSendConfirmation: true,
      defaultChatListLimit: 9,
      defaultMessageSearchLimit: 7,
    });

    expect(Array.from(tools.keys()).sort()).toEqual([
      "whatsapp_chats_list",
      "whatsapp_doctor",
      "whatsapp_history_backfill",
      "whatsapp_messages_search",
      "whatsapp_send_file",
      "whatsapp_send_text",
    ]);

    const chats = await tools.get("whatsapp_chats_list").execute("1", { query: "alpha" });
    expect(chats.content[0].text).toContain("Project Alpha");
    expect(chats.details.count).toBe(2);

    const messages = await tools
      .get("whatsapp_messages_search")
      .execute("2", { query: "invoice", chat: "1234567890-123456789@g.us" });
    expect(messages.content[0].text).toContain("Result for invoice");
    expect(messages.details.count).toBe(1);

    const doctor = await tools.get("whatsapp_doctor").execute("3", {});
    expect(doctor.content[0].text).toContain("doctor ok");

    const backfill = await tools
      .get("whatsapp_history_backfill")
      .execute("4", { chat: "1234567890-123456789@g.us" });
    expect(backfill.content[0].text).toContain("backfill queued");

    await expect(
      tools.get("whatsapp_send_text").execute("5", {
        to: "+14155551212",
        message: "hola",
      }),
    ).rejects.toThrow("confirm=true");

    const sentText = await tools.get("whatsapp_send_text").execute("6", {
      to: "+14155551212",
      message: "hola",
      confirm: true,
    });
    expect(sentText.content[0].text).toContain("sent text to +14155551212");

    const sentFile = await tools.get("whatsapp_send_file").execute("7", {
      to: "1234567890-123456789@g.us",
      file: "/tmp/agenda.pdf",
      caption: "Agenda",
      confirm: true,
    });
    expect(sentFile.content[0].text).toContain("sent file to 1234567890-123456789@g.us");

    const calls = readFileSync(fakeWacli.logPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { json: boolean; args: string[] });

    expect(calls).toEqual([
      {
        json: true,
        args: ["chats", "list", "--limit", "9", "--query", "alpha"],
      },
      {
        json: true,
        args: [
          "messages",
          "search",
          "invoice",
          "--limit",
          "7",
          "--chat",
          "1234567890-123456789@g.us",
        ],
      },
      {
        json: false,
        args: ["doctor"],
      },
      {
        json: false,
        args: [
          "history",
          "backfill",
          "--chat",
          "1234567890-123456789@g.us",
          "--requests",
          "2",
          "--count",
          "50",
        ],
      },
      {
        json: false,
        args: [
          "send",
          "text",
          "--to",
          "+14155551212",
          "--message",
          "hola",
        ],
      },
      {
        json: false,
        args: [
          "send",
          "file",
          "--to",
          "1234567890-123456789@g.us",
          "--file",
          "/tmp/agenda.pdf",
          "--caption",
          "Agenda",
        ],
      },
    ]);
  });

  it("packs only the minimal publish surface", async () => {
    const packageDir = path.resolve(import.meta.dirname, "../..");
    const { stdout } = await execFileAsync("npm", ["pack", "--json", "--dry-run"], {
      cwd: packageDir,
      encoding: "utf8",
    });
    const packed = JSON.parse(stdout) as Array<{
      files: Array<{ path: string }>;
    }>;
    const paths = packed[0]?.files.map((file) => file.path).sort();

    expect(paths).toEqual([
      "README.md",
      "dist/index.d.ts",
      "dist/index.js",
      "openclaw.plugin.json",
      "package.json",
      "skills/whatsapp/SKILL.md",
    ]);
  });
});
