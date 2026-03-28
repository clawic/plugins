import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { formatIssue, formatIssueList, formatOrganizationList, formatProjectList } from "./format.js";
import { SentryStore } from "./store.js";
function toolTextResult(text, details) {
    return {
        content: [{ type: "text", text }],
        details,
    };
}
export default definePluginEntry({
    id: "sentry",
    name: "Sentry",
    description: "Inspect Sentry organizations, projects, and issues inside OpenClaw",
    register(api) {
        const store = new SentryStore(api.pluginConfig ?? {});
        api.registerTool({
            name: "sentry_list_organizations",
            label: "List Sentry organizations",
            description: "List organizations available to the configured Sentry token",
            parameters: Type.Object({
                query: Type.Optional(Type.String()),
                owner: Type.Optional(Type.Boolean()),
                sortBy: Type.Optional(Type.String({ minLength: 1 })),
                limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
            }),
            async execute(_id, params) {
                const organizations = await store.listOrganizations(params);
                return toolTextResult(formatOrganizationList("Matching organizations", organizations), {
                    status: "ok",
                    count: organizations.length,
                    organizations,
                });
            },
        });
        api.registerTool({
            name: "sentry_list_projects",
            label: "List Sentry projects",
            description: "List projects for one Sentry organization",
            parameters: Type.Object({
                organizationSlug: Type.Optional(Type.String({ minLength: 1 })),
                limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
            }),
            async execute(_id, params) {
                const projects = await store.listProjects(params);
                return toolTextResult(formatProjectList("Matching projects", projects), {
                    status: "ok",
                    count: projects.length,
                    projects,
                });
            },
        });
        api.registerTool({
            name: "sentry_list_issues",
            label: "List Sentry issues",
            description: "List issues for a Sentry organization or one project using Sentry query syntax",
            parameters: Type.Object({
                organizationSlug: Type.Optional(Type.String({ minLength: 1 })),
                projectSlug: Type.Optional(Type.String({ minLength: 1 })),
                query: Type.Optional(Type.String()),
                sort: Type.Optional(Type.String({ minLength: 1 })),
                limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
            }),
            async execute(_id, params) {
                const issues = await store.listIssues(params);
                return toolTextResult(formatIssueList("Matching issues", issues), {
                    status: "ok",
                    count: issues.length,
                    issues,
                });
            },
        });
        api.registerTool({
            name: "sentry_get_issue",
            label: "Get Sentry issue",
            description: "Fetch one Sentry issue by issue id and return detailed triage context",
            parameters: Type.Object({
                organizationSlug: Type.Optional(Type.String({ minLength: 1 })),
                issueId: Type.String({ minLength: 1 }),
            }),
            async execute(_id, params) {
                const issue = await store.getIssue(params);
                return toolTextResult(formatIssue(issue), {
                    status: "ok",
                    issue,
                });
            },
        });
    },
});
