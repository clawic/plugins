export type SentryPluginConfig = {
  authToken?: string;
  baseUrl?: string;
  defaultOrganizationSlug?: string;
  defaultProjectSlug?: string;
};

export type ListOrganizationsInput = {
  query?: string;
  owner?: boolean;
  sortBy?: string;
  limit?: number;
};

export type ListProjectsInput = {
  organizationSlug?: string;
  limit?: number;
};

export type ListIssuesInput = {
  organizationSlug?: string;
  projectSlug?: string;
  query?: string;
  sort?: string;
  limit?: number;
};

export type GetIssueInput = {
  organizationSlug?: string;
  issueId: string;
};

export type SentryOrganization = {
  id: string;
  slug: string;
  name: string;
  status?: string;
  url?: string;
  dateCreated?: string;
};

export type SentryProject = {
  id: string;
  slug: string;
  name: string;
  platform?: string;
  status?: string;
  teamSlug?: string;
  isMember?: boolean;
  dateCreated?: string;
};

export type SentryIssue = {
  id: string;
  shortId?: string;
  title: string;
  culprit?: string;
  level?: string;
  status?: string;
  projectSlug?: string;
  count?: number;
  userCount?: number;
  permalink?: string;
  firstSeen?: string;
  lastSeen?: string;
  assignedTo?: string;
};
