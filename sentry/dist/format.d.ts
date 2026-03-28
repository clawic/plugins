import type { SentryIssue, SentryOrganization, SentryProject } from "./types.js";
export declare function formatOrganization(organization: SentryOrganization): string;
export declare function formatOrganizationList(title: string, organizations: SentryOrganization[]): string;
export declare function formatProject(project: SentryProject): string;
export declare function formatProjectList(title: string, projects: SentryProject[]): string;
export declare function formatIssue(issue: SentryIssue): string;
export declare function formatIssueList(title: string, issues: SentryIssue[]): string;
