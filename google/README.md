# Google Plugin

OpenClaw web search provider that routes `web_search` through Google results via SerpApi.

## Install

```bash
npm install
npm run build
openclaw plugins install .
openclaw plugins enable google
openclaw gateway restart
```

## Config

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "google",
      },
    },
  },
  plugins: {
    entries: {
      google: {
        enabled: true,
        config: {
          webSearch: {
            apiKey: "YOUR_SERPAPI_KEY", // pragma: allowlist secret
            location: "Madrid, Spain",
            country: "es",
            language: "es",
            safeSearch: "active",
            count: 5,
          },
        },
      },
    },
  },
}
```

You can also provide the credential through the gateway environment with `SERPAPI_API_KEY`.

## Usage

After selecting the provider, use the built-in `web_search` tool:

```javascript
await web_search({
  query: "latest OpenClaw plugin SDK changes",
  count: 5,
  country: "us",
  language: "en",
  location: "Austin, Texas, United States",
  safeSearch: "active",
});
```

Supported parameters:

- `query`
- `count`
- `location`
- `country`
- `language`
- `site`
- `safeSearch`
