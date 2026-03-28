import { readFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import plugin from "../../src/index.js";

type RegisteredTool = {
  name: string;
  execute: (id: string, params: any) => Promise<any>;
};

function createHarness(pluginConfig: Record<string, unknown> = {}) {
  const tools = new Map<string, RegisteredTool>();

  plugin.register({
    pluginConfig,
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

function toUrl(input: unknown): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  if (input && typeof input === "object" && "url" in input) {
    return new URL(String((input as { url: string }).url));
  }
  throw new Error(`Unsupported fetch input: ${String(input)}`);
}

describe("sentry plugin e2e", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

    expect(packageJson.name).toBe("sentry");
    expect(manifest.id).toBe("sentry");
    expect(packageJson.openclaw?.compat?.pluginApi).toBe(">=2026.3.23");
    expect(packageJson.openclaw?.build?.openclawVersion).toBe("2026.3.23-2");
    expect(manifest.version).toBe(packageJson.version);
  });

  it("registers Sentry tools and uses configured auth, base URL, and defaults", async () => {
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = toUrl(input);
      expect(init?.method).toBe("GET");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sentry-token");

      if (url.pathname === "/api/0/organizations/") {
        expect(url.searchParams.get("query")).toBe("acme");
        expect(url.searchParams.get("owner")).toBe("true");
        expect(url.searchParams.get("sortBy")).toBe("projects");
        return new Response(
          JSON.stringify([
            {
              id: "1",
              slug: "acme",
              name: "Acme",
              status: { id: "active" },
              links: { organizationUrl: "https://acme.sentry.io" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.pathname === "/api/0/organizations/acme/projects/") {
        return new Response(
          JSON.stringify([
            {
              id: "10",
              slug: "frontend",
              name: "Frontend",
              platform: "javascript",
              status: "active",
              isMember: true,
              team: { slug: "web" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.pathname === "/api/0/organizations/acme/issues/") {
        expect(url.searchParams.get("query")).toBe("project:frontend is:unresolved level:error");
        expect(url.searchParams.get("sort")).toBe("date");
        return new Response(
          JSON.stringify([
            {
              id: "123",
              shortId: "ACME-123",
              title: "TypeError in checkout",
              level: "error",
              status: "unresolved",
              count: "17",
              userCount: 4,
              firstSeen: "2026-03-20T08:00:00Z",
              lastSeen: "2026-03-29T08:00:00Z",
              project: { slug: "frontend" },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (url.pathname === "/api/0/organizations/acme/issues/123/") {
        return new Response(
          JSON.stringify({
            id: "123",
            shortId: "ACME-123",
            metadata: { title: "TypeError in checkout" },
            culprit: "checkout.tsx in submitOrder",
            level: "error",
            status: "unresolved",
            count: "17",
            userCount: "4",
            permalink: "https://acme.sentry.io/issues/123/",
            firstSeen: "2026-03-20T08:00:00Z",
            lastSeen: "2026-03-29T08:00:00Z",
            project: { slug: "frontend" },
            assignedTo: { name: "Payments Team" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unexpected fetch: ${url.toString()}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const harness = createHarness({
      authToken: "sentry-token",
      baseUrl: "https://acme.sentry.local",
      defaultOrganizationSlug: "acme",
      defaultProjectSlug: "frontend",
    });

    expect([...harness.tools.keys()].sort()).toEqual([
      "sentry_get_issue",
      "sentry_list_issues",
      "sentry_list_organizations",
      "sentry_list_projects",
    ]);

    const organizations = await harness.execute("sentry_list_organizations", {
      query: "acme",
      owner: true,
      sortBy: "projects",
    });
    expect(organizations.details.count).toBe(1);
    expect(organizations.details.organizations[0].slug).toBe("acme");
    expect(organizations.content[0].text).toContain("Acme (acme)");

    const projects = await harness.execute("sentry_list_projects", {});
    expect(projects.details.projects[0].slug).toBe("frontend");
    expect(projects.content[0].text).toContain("Frontend (frontend)");

    const issues = await harness.execute("sentry_list_issues", {
      query: "is:unresolved level:error",
      sort: "date",
    });
    expect(issues.details.count).toBe(1);
    expect(issues.details.issues[0].shortId).toBe("ACME-123");
    expect(issues.details.issues[0].count).toBe(17);

    const issue = await harness.execute("sentry_get_issue", { issueId: "123" });
    expect(issue.details.issue.assignedTo).toBe("Payments Team");
    expect(issue.content[0].text).toContain("Permalink: https://acme.sentry.io/issues/123/");

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails clearly when the plugin is missing required auth config", () => {
    expect(() => createHarness()).toThrow("Sentry authToken is required.");
  });
});
