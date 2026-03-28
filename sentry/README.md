# Sentry Plugin

Native OpenClaw plugin that adds Sentry triage workflows with:

- organization discovery for the authenticated token
- project listing within a Sentry organization
- issue search across an organization or one project
- full issue detail retrieval for debugging context

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable sentry
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      sentry: {
        enabled: true,
        config: {
          authToken: "YOUR_SENTRY_AUTH_TOKEN", // pragma: allowlist secret
          baseUrl: "https://sentry.io",
          defaultOrganizationSlug: "my-org",
          defaultProjectSlug: "web-app",
        },
      },
    },
  },
}
```

Recommended token scopes:

- `org:read` for organization and project discovery
- `event:read` for issue listing and retrieval

## Tools

- `sentry_list_organizations`
- `sentry_list_projects`
- `sentry_list_issues`
- `sentry_get_issue`
