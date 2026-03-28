import type { GetIssueInput, ListIssuesInput, ListOrganizationsInput, ListProjectsInput, SentryIssue, SentryOrganization, SentryPluginConfig, SentryProject } from "./types.js";
type FetchLike = typeof fetch;
export declare class SentryStore {
    private readonly authToken;
    private readonly baseApiUrl;
    private readonly defaultOrganizationSlug?;
    private readonly defaultProjectSlug?;
    private readonly fetchImpl;
    constructor(config?: SentryPluginConfig, fetchImpl?: FetchLike);
    listOrganizations(input?: ListOrganizationsInput): Promise<SentryOrganization[]>;
    listProjects(input?: ListProjectsInput): Promise<SentryProject[]>;
    listIssues(input?: ListIssuesInput): Promise<SentryIssue[]>;
    getIssue(input: GetIssueInput): Promise<SentryIssue>;
    private resolveOrganizationSlug;
    private request;
}
export {};
