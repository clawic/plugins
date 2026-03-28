import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import plugin from "../../src/index.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

type RegisteredTool = {
  name: string;
  execute: (_id: string, params: any) => Promise<{ content: Array<{ type: string; text: string }>; details: any }>;
};

function createHarness(storagePath: string) {
  const tools = new Map<string, RegisteredTool>();

  plugin.register({
    id: "deep-research",
    name: "Deep Research",
    source: import.meta.dirname,
    registrationMode: "full",
    pluginConfig: {
      storagePath,
    },
    logger: {
      info() {},
      warn() {},
      error() {},
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

describe("deep-research plugin e2e", () => {
  it("ships the publish metadata and research skill surface required by clawhub", async () => {
    const packageJsonPath = path.resolve(import.meta.dirname, "../../package.json");
    const manifestPath = path.resolve(import.meta.dirname, "../../openclaw.plugin.json");
    const skillPath = path.resolve(import.meta.dirname, "../../skills/deep-research/SKILL.md");
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

    expect(packageJson.name).toBe("deep-research");
    expect(manifest.id).toBe("deep-research");
    expect(manifest.version).toBe(packageJson.version);
    expect(manifest.skills).toEqual(["skills/deep-research"]);
    expect(packageJson.openclaw?.compat?.pluginApi).toBe(">=2026.3.23");
    expect(packageJson.openclaw?.build?.openclawVersion).toBe("2026.3.23-2");
    expect(skill).toContain("deep_research_add_resource");
    expect(skill).toContain("Start or focus a research session");
  });

  it("handles multiple research workspaces, active focus, resource capture, and synthesis history", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "deep-research-plugin-"));
    tempDirs.push(tempDir);
    const storagePath = path.join(tempDir, "research.json");
    const harness = createHarness(storagePath);

    expect([...harness.tools.keys()].sort()).toEqual([
      "deep_research_add_resource",
      "deep_research_add_synthesis",
      "deep_research_create",
      "deep_research_focus",
      "deep_research_get",
      "deep_research_list",
      "deep_research_update",
    ]);

    const marketMap = await harness.execute("deep_research_create", {
      title: "AI Browser MCP Landscape",
      question: "Which coding tools currently support browser MCP flows well enough for production use?",
      objective: "Produce a recommendation memo.",
      scope: "Desktop coding agents used by engineering teams.",
      tags: ["mcp", "browser", "agents"],
      phase: "framing",
    });
    const firstResearchId = marketMap.details.research.id as string;

    const savedResource = await harness.execute("deep_research_add_resource", {
      title: "Vendor release notes",
      url: "https://example.com/release-notes",
      sourceType: "web",
      summary: "Mentions browser MCP support behind a flag.",
      notes: "Need secondary confirmation.",
      author: "Vendor",
      publishedAt: "2026-03-25",
    });
    expect(savedResource.content[0].text).toContain("Resource saved");
    expect(savedResource.details.resource.url).toBe("https://example.com/release-notes");

    const savedSynthesis = await harness.execute("deep_research_add_synthesis", {
      title: "Initial framing",
      body: "Need to separate supported browser control from marketing demos.",
      confidence: "medium",
      openQuestions: ["Which tools support stable reconnects?"],
      nextSteps: ["Collect official docs for each vendor"],
    });
    expect(savedSynthesis.content[0].text).toContain("Synthesis saved");
    expect(savedSynthesis.details.synthesis.phase).toBe("framing");

    const secondResearch = await harness.execute("deep_research_create", {
      title: "EU AI Act Timeline",
      question: "What dates matter for enforcement milestones and obligations?",
      tags: ["policy", "eu"],
      phase: "collection",
      setActive: false,
    });
    const secondResearchId = secondResearch.details.research.id as string;

    const filtered = await harness.execute("deep_research_list", {
      search: "browser MCP",
    });
    expect(filtered.details.count).toBe(1);
    expect(filtered.details.researches[0].id).toBe(firstResearchId);
    expect(filtered.details.activeResearchId).toBe(firstResearchId);

    const focused = await harness.execute("deep_research_focus", {
      researchId: secondResearchId,
    });
    expect(focused.details.research.id).toBe(secondResearchId);

    await harness.execute("deep_research_add_resource", {
      title: "Official regulation page",
      url: "https://example.eu/ai-act",
      sourceType: "document",
      summary: "Contains the legal text and milestone dates.",
    });

    const updated = await harness.execute("deep_research_update", {
      researchId: secondResearchId,
      phase: "analysis",
      status: "active",
      addTags: ["timeline"],
    });
    expect(updated.content[0].text).toContain("phase=analysis");

    const fetched = await harness.execute("deep_research_get", {});
    expect(fetched.details.research.id).toBe(secondResearchId);
    expect(fetched.content[0].text).toContain("Official regulation page");

    const persisted = JSON.parse(await readFile(storagePath, "utf8")) as {
      version: number;
      activeResearchId?: string;
      researches: Array<{
        id: string;
        tags: string[];
        resources: Array<{ id: string }>;
        syntheses: Array<{ id: string }>;
        phase: string;
      }>;
    };

    expect(persisted.version).toBe(1);
    expect(persisted.activeResearchId).toBe(secondResearchId);
    expect(
      persisted.researches.some(
        (research) =>
          research.id === firstResearchId &&
          research.resources.length === 1 &&
          research.syntheses.length === 1,
      ),
    ).toBe(true);
    expect(
      persisted.researches.some(
        (research) =>
          research.id === secondResearchId &&
          research.phase === "analysis" &&
          research.tags.includes("timeline") &&
          research.resources.length === 1,
      ),
    ).toBe(true);
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
      "dist/format.d.ts",
      "dist/format.js",
      "dist/index.d.ts",
      "dist/index.js",
      "dist/store.d.ts",
      "dist/store.js",
      "dist/types.d.ts",
      "dist/types.js",
      "openclaw.plugin.json",
      "package.json",
      "skills/deep-research/SKILL.md",
    ]);
  });
});
