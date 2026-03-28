# Cloudflare Plugin

Native OpenClaw plugin that adds Cloudflare API workflows with:

- zone discovery by account, name, and status
- DNS record listing, creation, update, and deletion
- cache purge by full zone or explicit file URLs

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable cloudflare
openclaw gateway restart
```

## Config

```json5
{
  plugins: {
    entries: {
      cloudflare: {
        enabled: true,
        config: {
          apiToken: "YOUR_CLOUDFLARE_API_TOKEN", // pragma: allowlist secret
          defaultZoneId: "your-zone-id",
          defaultAccountId: "your-account-id",
        },
      },
    },
  },
}
```

Recommended token scopes:

- `Zone:Read` for `cloudflare_list_zones`
- `DNS:Read` and `DNS:Edit` for DNS record tools
- `Cache Purge:Purge` for `cloudflare_purge_cache`

## Tools

- `cloudflare_list_zones`
- `cloudflare_list_dns_records`
- `cloudflare_upsert_dns_record`
- `cloudflare_delete_dns_record`
- `cloudflare_purge_cache`
