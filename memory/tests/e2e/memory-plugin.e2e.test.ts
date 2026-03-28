import { mkdtemp, readFile, rm } from "node:fs/promises";
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
    id: "memory",
    name: "Memory",
    source: path.dirname(storagePath),
    pluginConfig: {
      storagePath,
      defaultTopic: "people",
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

describe("memory plugin e2e", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("ships the publish metadata required by clawhub", async () => {
    const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
    const manifestPath = path.resolve(import.meta.dirname, "../../openclaw.plugin.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      name: string;
      version: string;
      openclaw?: {
        compat?: {
          pluginApi?: string;
        };
      };
    };
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      id: string;
      version?: string;
    };

    expect(packageJson.name).toBe("memory");
    expect(manifest.id).toBe("memory");
    expect(packageJson.openclaw?.compat?.pluginApi).toBe(">=2026.3.23");
    expect(manifest.version).toBe(packageJson.version);
  });

  it("supports memory capture, recall, reinforcement, and archive flow", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "memory-plugin-e2e-"));
    tempDirs.push(tempDir);

    const storagePath = path.join(tempDir, "memory.json");
    const harness = createHarness(storagePath);
    expect([...harness.tools.keys()].sort()).toEqual([
      "memory_delete",
      "memory_get",
      "memory_recall",
      "memory_reinforce",
      "memory_remember",
      "memory_update",
    ]);

    const created = await harness.execute("memory_remember", {
      summary: "Alice prefers async status updates",
      details: "Use a written update before meetings when possible.",
      tags: ["alice", "communication"],
      importance: "high",
      pinned: true,
    });
    const primaryMemoryId = created.details.memory.id;

    await harness.execute("memory_reinforce", {
      memoryId: primaryMemoryId,
      body: "Confirmed again during the March planning review.",
    });

    await harness.execute("memory_update", {
      memoryId: primaryMemoryId,
      summary: "Alice prefers async updates before meetings",
      addTags: ["team"],
      removeTags: ["communication"],
      topic: "people",
    });

    await harness.execute("memory_remember", {
      summary: "Q2 launch draft lives in Drive folder 7",
      details: "Keep the finance appendix separate from the comms draft.",
      topic: "projects",
      importance: "medium",
    });

    const fetched = await harness.execute("memory_get", { memoryId: primaryMemoryId });
    expect(fetched.details.memory.summary).toBe("Alice prefers async updates before meetings");
    expect(fetched.details.memory.observations).toHaveLength(1);
    expect(fetched.details.memory.tags).toEqual(["alice", "team"]);
    expect(fetched.details.memory.lastRecalledAt).toBeTruthy();
    expect(fetched.content[0].text).toContain("Confirmed again during the March planning review.");

    const searchResult = await harness.execute("memory_recall", {
      search: "finance appendix",
    });
    expect(searchResult.details.count).toBe(1);
    expect(searchResult.details.memories[0].summary).toContain("Q2 launch draft");

    const pinnedResult = await harness.execute("memory_recall", {
      pinned: true,
    });
    expect(pinnedResult.details.count).toBe(1);
    expect(pinnedResult.details.memories[0].id).toBe(primaryMemoryId);

    const topicResult = await harness.execute("memory_recall", {
      topic: "people",
      importance: "high",
    });
    expect(topicResult.details.count).toBe(1);
    expect(topicResult.details.memories[0].id).toBe(primaryMemoryId);

    await harness.execute("memory_delete", { memoryId: primaryMemoryId });

    const defaultList = await harness.execute("memory_recall", {
      search: "March planning review",
    });
    expect(defaultList.details.count).toBe(0);

    const archivedList = await harness.execute("memory_recall", {
      search: "March planning review",
      includeArchived: true,
    });
    expect(archivedList.details.count).toBe(1);
    expect(archivedList.details.memories[0].status).toBe("archived");
  });
});
