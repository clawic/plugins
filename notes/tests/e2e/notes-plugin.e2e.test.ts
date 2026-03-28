import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import plugin from "../../src/index.js";

type RegisteredTool = {
  name: string;
  execute: (id: string, params: any) => Promise<any>;
};

function createHarness(storagePath: string) {
  const tools = new Map<string, RegisteredTool>();

  plugin.register({
    pluginConfig: {
      storagePath,
      defaultNotebook: "inbox",
    },
    registerTool(tool: RegisteredTool) {
      tools.set(tool.name, tool);
    },
  } as any);

  return {
    tools,
    async execute(name: string, params: any) {
      const tool = tools.get(name);
      if (!tool) {
        throw new Error(`Tool not registered: ${name}`);
      }
      return tool.execute(`test-${name}`, params);
    },
  };
}

describe("notes plugin e2e", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("supports note capture, append history, search, and archive flow", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "notes-plugin-e2e-"));
    tempDirs.push(tempDir);

    const harness = createHarness(path.join(tempDir, "notes.json"));
    expect([...harness.tools.keys()].sort()).toEqual([
      "notes_append",
      "notes_create",
      "notes_delete",
      "notes_get",
      "notes_list",
      "notes_update",
    ]);

    const created = await harness.execute("notes_create", {
      title: "Client sync",
      body: "Initial agenda",
      tags: ["meeting", "client"],
      pinned: true,
    });
    const primaryNoteId = created.details.note.id;

    await harness.execute("notes_append", {
      noteId: primaryNoteId,
      body: "Decision: move launch review to Friday.",
    });

    await harness.execute("notes_update", {
      noteId: primaryNoteId,
      title: "Client sync summary",
      addTags: ["summary"],
      removeTags: ["client"],
    });

    await harness.execute("notes_create", {
      title: "Backlog ideas",
      body: "Potential automations to evaluate.",
      notebook: "ideas",
    });

    const fetched = await harness.execute("notes_get", { noteId: primaryNoteId });
    expect(fetched.details.note.title).toBe("Client sync summary");
    expect(fetched.details.note.entries).toHaveLength(1);
    expect(fetched.details.note.tags).toEqual(["meeting", "summary"]);
    expect(fetched.content[0].text).toContain("Decision: move launch review to Friday.");

    const searchResult = await harness.execute("notes_list", {
      search: "launch review",
    });
    expect(searchResult.details.count).toBe(1);
    expect(searchResult.details.notes[0].id).toBe(primaryNoteId);

    const pinnedResult = await harness.execute("notes_list", {
      pinned: true,
    });
    expect(pinnedResult.details.count).toBe(1);
    expect(pinnedResult.details.notes[0].id).toBe(primaryNoteId);

    await harness.execute("notes_delete", { noteId: primaryNoteId });

    const defaultList = await harness.execute("notes_list", {
      search: "launch review",
    });
    expect(defaultList.details.count).toBe(0);

    const archivedList = await harness.execute("notes_list", {
      search: "launch review",
      includeArchived: true,
    });
    expect(archivedList.details.count).toBe(1);
    expect(archivedList.details.notes[0].status).toBe("archived");
  });
});
