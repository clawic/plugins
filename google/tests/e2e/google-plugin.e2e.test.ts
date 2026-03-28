import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import plugin from "../../src/index.js";

type RegisteredProvider = ReturnType<typeof createHarness>["provider"];

function createHarness(config: Record<string, unknown> = {}, searchConfig: Record<string, unknown> = {}) {
  let provider: any;

  plugin.register({
    id: "google",
    name: "Google",
    source: import.meta.dirname,
    registrationMode: "full",
    config,
    pluginConfig: {},
    logger: {
      info() {},
      warn() {},
      error() {},
    },
    registerWebSearchProvider(value: unknown) {
      provider = value;
    },
  } as any);

  if (!provider) {
    throw new Error("Google provider was not registered.");
  }

  return {
    provider,
    createTool() {
      return provider.createTool({ config, searchConfig } as any);
    },
  };
}

function toUrl(input: unknown): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  if (input && typeof input === "object" && "url" in input) {
    return new URL(String((input as { url: string }).url));
  }
  throw new Error(`Unsupported fetch input: ${String(input)}`);
}

describe("google plugin e2e", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.SERPAPI_API_KEY;
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
        build?: {
          openclawVersion?: string;
        };
      };
    };
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      id: string;
      version?: string;
    };

    expect(packageJson.name).toBe("google");
    expect(manifest.id).toBe("google");
    expect(packageJson.openclaw?.compat?.pluginApi).toBe(">=2026.3.23");
    expect(packageJson.openclaw?.build?.openclawVersion).toBe("2026.3.23-2");
    expect(manifest.version).toBe(packageJson.version);
  });

  it("registers the Google web search provider, resolves credentials, and caches results", async () => {
    process.env.SERPAPI_API_KEY = "test-key";

    const fetchMock = vi.fn(async (input: unknown) => {
      const url = toUrl(input);
      expect(url.hostname).toBe("serpapi.com");
      expect(url.searchParams.get("engine")).toBe("google");
      expect(url.searchParams.get("api_key")).toBe("test-key");
      expect(url.searchParams.get("q")).toBe("site:docs.openclaw.ai openclaw sdk");
      expect(url.searchParams.get("num")).toBe("3");
      expect(url.searchParams.get("location")).toBe("Austin, Texas, United States");
      expect(url.searchParams.get("gl")).toBe("us");
      expect(url.searchParams.get("hl")).toBe("en");
      expect(url.searchParams.get("safe")).toBe("active");

      return new Response(
        JSON.stringify({
          search_information: { total_results: 3210 },
          answer_box: { answer: "OpenClaw SDK" },
          organic_results: [
            {
              title: "Plugin SDK Overview",
              link: "https://docs.openclaw.ai/plugins/sdk-overview",
              snippet: "Official OpenClaw plugin SDK overview.",
            },
            {
              title: "Web Search Tool",
              link: "https://docs.openclaw.ai/tools/web",
              snippet: "OpenClaw web search provider docs.",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const harness = createHarness(
      {
        plugins: {
          entries: {
            google: {
              config: {
                webSearch: {
                  location: "Austin, Texas, United States",
                  country: "us",
                  language: "en",
                  safeSearch: "active",
                  count: 3,
                  cacheTtlMinutes: 30,
                },
              },
            },
          },
        },
      },
      {},
    );

    const provider = harness.provider as RegisteredProvider;
    expect(provider.id).toBe("google");
    expect(provider.envVars).toEqual(["SERPAPI_API_KEY"]);

    const tool = harness.createTool();
    const first = await tool.execute({
      query: "openclaw sdk",
      site: "docs.openclaw.ai",
    });

    expect(first.provider).toBe("google");
    expect(first.count).toBe(2);
    expect(first.summary).toBe("OpenClaw SDK");
    expect(first.totalResults).toBe(3210);
    expect(first.results[0].url).toBe("https://docs.openclaw.ai/plugins/sdk-overview");
    expect(first.results[0].siteName).toBe("docs.openclaw.ai");
    expect(first.cached).toBeUndefined();

    const second = await tool.execute({
      query: "openclaw sdk",
      site: "docs.openclaw.ai",
    });

    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails clearly when no SerpApi credential is configured", async () => {
    const harness = createHarness();
    const tool = harness.createTool();

    await expect(tool.execute({ query: "openclaw sdk" })).rejects.toThrow(
      "Missing SerpApi credential",
    );
  });
});
