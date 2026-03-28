import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import plugin from "../../src/index.js";

const execFileAsync = promisify(execFile);

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
    expect(skill).toContain("wacli send text");
    expect(skill).toContain("wacli history backfill");
  });

  it("registers as a no-op skill package without adding runtime tools", () => {
    const registeredTools: unknown[] = [];
    const registeredProviders: unknown[] = [];

    expect(() =>
      plugin.register({
        id: "whatsapp",
        name: "WhatsApp",
        source: import.meta.dirname,
        registrationMode: "full",
        config: {},
        pluginConfig: {},
        logger: {
          info() {},
          warn() {},
          error() {},
        },
        registerTool(value: unknown) {
          registeredTools.push(value);
        },
        registerWebSearchProvider(value: unknown) {
          registeredProviders.push(value);
        },
      } as any),
    ).not.toThrow();

    expect(registeredTools).toHaveLength(0);
    expect(registeredProviders).toHaveLength(0);
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
