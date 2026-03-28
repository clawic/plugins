function formatOptionalLine(label, value) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    return `${label}: ${value}`;
}
export function formatOrganization(organization) {
    return [
        `${organization.name} (${organization.slug})`,
        formatOptionalLine("Status", organization.status),
        formatOptionalLine("URL", organization.url),
    ]
        .filter(Boolean)
        .join("\n");
}
export function formatOrganizationList(title, organizations) {
    if (!organizations.length) {
        return `${title}: none`;
    }
    return [
        `${title}:`,
        ...organizations.map((organization) => `- ${organization.name} (${organization.slug})`),
    ].join("\n");
}
export function formatProject(project) {
    return [
        `${project.name} (${project.slug})`,
        formatOptionalLine("Platform", project.platform),
        formatOptionalLine("Status", project.status),
        formatOptionalLine("Team", project.teamSlug),
        formatOptionalLine("Member", project.isMember),
    ]
        .filter(Boolean)
        .join("\n");
}
export function formatProjectList(title, projects) {
    if (!projects.length) {
        return `${title}: none`;
    }
    return [
        `${title}:`,
        ...projects.map((project) => `- ${project.name} (${project.slug})`),
    ].join("\n");
}
export function formatIssue(issue) {
    return [
        `${issue.shortId ?? issue.id}: ${issue.title}`,
        formatOptionalLine("Project", issue.projectSlug),
        formatOptionalLine("Status", issue.status),
        formatOptionalLine("Level", issue.level),
        formatOptionalLine("Assigned to", issue.assignedTo),
        formatOptionalLine("Events", issue.count),
        formatOptionalLine("Users", issue.userCount),
        formatOptionalLine("First seen", issue.firstSeen),
        formatOptionalLine("Last seen", issue.lastSeen),
        formatOptionalLine("Culprit", issue.culprit),
        formatOptionalLine("Permalink", issue.permalink),
    ]
        .filter(Boolean)
        .join("\n");
}
export function formatIssueList(title, issues) {
    if (!issues.length) {
        return `${title}: none`;
    }
    return [
        `${title}:`,
        ...issues.map((issue) => `- ${issue.shortId ?? issue.id}: ${issue.title}`),
    ].join("\n");
}
