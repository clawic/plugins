const DEFAULT_SENTRY_BASE_URL = "https://sentry.io/api/0";
export class SentryStore {
    authToken;
    baseApiUrl;
    defaultOrganizationSlug;
    defaultProjectSlug;
    fetchImpl;
    constructor(config = {}, fetchImpl = fetch) {
        this.authToken = config.authToken?.trim() ?? "";
        this.baseApiUrl = normalizeBaseApiUrl(config.baseUrl);
        this.defaultOrganizationSlug = normalizeOptionalString(config.defaultOrganizationSlug);
        this.defaultProjectSlug = normalizeOptionalString(config.defaultProjectSlug);
        this.fetchImpl = fetchImpl;
        if (!this.authToken) {
            throw new Error("Sentry authToken is required.");
        }
    }
    async listOrganizations(input = {}) {
        const query = new URLSearchParams();
        if (input.owner !== undefined) {
            query.set("owner", String(input.owner));
        }
        if (input.query?.trim()) {
            query.set("query", input.query.trim());
        }
        if (input.sortBy?.trim()) {
            query.set("sortBy", input.sortBy.trim());
        }
        const response = await this.request(`/organizations/${query.size ? `?${query.toString()}` : ""}`);
        return response.map(mapOrganization).slice(0, normalizeLimit(input.limit));
    }
    async listProjects(input = {}) {
        const organizationSlug = this.resolveOrganizationSlug(input.organizationSlug);
        const response = await this.request(`/organizations/${encodeURIComponent(organizationSlug)}/projects/`);
        return response.map(mapProject).slice(0, normalizeLimit(input.limit));
    }
    async listIssues(input = {}) {
        const organizationSlug = this.resolveOrganizationSlug(input.organizationSlug);
        const projectSlug = normalizeOptionalString(input.projectSlug ?? this.defaultProjectSlug);
        const query = new URLSearchParams();
        const issueQuery = [projectSlug ? `project:${projectSlug}` : "", input.query?.trim() ?? ""]
            .filter(Boolean)
            .join(" ");
        if (issueQuery) {
            query.set("query", issueQuery);
        }
        if (input.sort?.trim()) {
            query.set("sort", input.sort.trim());
        }
        const response = await this.request(`/organizations/${encodeURIComponent(organizationSlug)}/issues/${query.size ? `?${query.toString()}` : ""}`);
        return response.map(mapIssue).slice(0, normalizeLimit(input.limit));
    }
    async getIssue(input) {
        const organizationSlug = this.resolveOrganizationSlug(input.organizationSlug);
        const issueId = input.issueId?.trim();
        if (!issueId) {
            throw new Error("issueId is required.");
        }
        const response = await this.request(`/organizations/${encodeURIComponent(organizationSlug)}/issues/${encodeURIComponent(issueId)}/`);
        return mapIssue(response);
    }
    resolveOrganizationSlug(organizationSlug) {
        const resolved = normalizeOptionalString(organizationSlug ?? this.defaultOrganizationSlug);
        if (!resolved) {
            throw new Error("organizationSlug is required when no defaultOrganizationSlug is configured.");
        }
        return resolved;
    }
    async request(path) {
        const response = await this.fetchImpl(`${this.baseApiUrl}${path}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${this.authToken}`,
            },
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Sentry API error (${response.status}): ${detail || response.statusText}`);
        }
        return (await response.json());
    }
}
function normalizeBaseApiUrl(value) {
    const normalized = normalizeOptionalString(value);
    if (!normalized) {
        return DEFAULT_SENTRY_BASE_URL;
    }
    const trimmed = normalized.replace(/\/+$/, "");
    return trimmed.endsWith("/api/0") ? trimmed : `${trimmed}/api/0`;
}
function normalizeOptionalString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.trim();
    return normalized || undefined;
}
function normalizeLimit(value) {
    if (!Number.isInteger(value) || (value ?? 0) < 1) {
        return 25;
    }
    return Math.min(value, 100);
}
function asString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function asNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return undefined;
}
function mapOrganization(value) {
    const status = value.status;
    const statusId = status && typeof status === "object" && "id" in status ? asString(status.id) : asString(status);
    const links = value.links;
    const organizationUrl = links && typeof links === "object" && "organizationUrl" in links
        ? asString(links.organizationUrl)
        : undefined;
    return {
        id: asString(value.id) ?? "",
        slug: asString(value.slug) ?? "",
        name: asString(value.name) ?? asString(value.slug) ?? "Unknown organization",
        status: statusId,
        url: organizationUrl,
        dateCreated: asString(value.dateCreated),
    };
}
function mapProject(value) {
    const team = value.team;
    const teamSlug = team && typeof team === "object" && "slug" in team ? asString(team.slug) : undefined;
    return {
        id: asString(value.id) ?? "",
        slug: asString(value.slug) ?? "",
        name: asString(value.name) ?? asString(value.slug) ?? "Unknown project",
        platform: asString(value.platform),
        status: asString(value.status),
        teamSlug,
        isMember: typeof value.isMember === "boolean" ? value.isMember : undefined,
        dateCreated: asString(value.dateCreated),
    };
}
function mapIssue(value) {
    const metadata = value.metadata;
    const metadataTitle = metadata && typeof metadata === "object" && "title" in metadata ? asString(metadata.title) : undefined;
    const project = value.project;
    const projectSlug = project && typeof project === "object" && "slug" in project ? asString(project.slug) : undefined;
    const assignedTo = value.assignedTo;
    const assignedName = assignedTo && typeof assignedTo === "object" && "name" in assignedTo
        ? asString(assignedTo.name)
        : undefined;
    return {
        id: asString(value.id) ?? "",
        shortId: asString(value.shortId),
        title: metadataTitle ?? asString(value.title) ?? asString(value.culprit) ?? "Untitled issue",
        culprit: asString(value.culprit),
        level: asString(value.level),
        status: asString(value.status),
        projectSlug,
        count: asNumber(value.count),
        userCount: asNumber(value.userCount),
        permalink: asString(value.permalink),
        firstSeen: asString(value.firstSeen),
        lastSeen: asString(value.lastSeen),
        assignedTo: assignedName,
    };
}
