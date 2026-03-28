import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import {
  buildSearchCacheKey,
  enablePluginInConfig,
  getScopedCredentialValue,
  mergeScopedSearchConfig,
  readCachedSearchPayload,
  readNumberParam,
  readResponseText,
  readStringParam,
  resolveProviderWebSearchPluginConfig,
  resolveWebSearchProviderCredential,
  resolveSearchCacheTtlMs,
  resolveSearchCount,
  resolveSearchTimeoutSeconds,
  resolveSiteName,
  setProviderWebSearchPluginConfigValue,
  setScopedCredentialValue,
  withTrustedWebSearchEndpoint,
  wrapWebContent,
  writeCachedSearchPayload,
} from "openclaw/plugin-sdk/provider-web-search";

const PROVIDER_ID = "google";
const SERP_API_ENDPOINT = "https://serpapi.com/search.json";
const DEFAULT_SAFE_SEARCH = "active";

const GoogleSearchSchema = Type.Object(
  {
    query: Type.String({ description: "Search query string." }),
    count: Type.Optional(
      Type.Number({
        description: "Number of results to return (1-10).",
        minimum: 1,
        maximum: 10,
      }),
    ),
    location: Type.Optional(Type.String({ description: "Optional Google location string." })),
    country: Type.Optional(
      Type.String({
        description: "Optional two-letter Google country code such as us or es.",
        minLength: 2,
        maxLength: 2,
      }),
    ),
    language: Type.Optional(
      Type.String({
        description: "Optional Google UI language code such as en or es.",
        minLength: 2,
        maxLength: 8,
      }),
    ),
    site: Type.Optional(Type.String({ description: "Optional domain restriction, for example example.com." })),
    safeSearch: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("off"),
      ]),
    ),
  },
  { additionalProperties: false },
);

type SearchConfigRecord = Record<string, unknown>;

type SerpApiOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

type SerpApiResponse = {
  error?: string;
  organic_results?: SerpApiOrganicResult[];
  answer_box?: {
    answer?: string;
    snippet?: string;
    snippet_highlighted_words?: string[];
  };
  knowledge_graph?: {
    description?: string;
  };
  search_information?: {
    total_results?: number;
  };
};

function resolveGoogleWebSearchConfig(config?: SearchConfigRecord): SearchConfigRecord | undefined {
  if (!config) return undefined;
  const webSearch = config.webSearch;
  if (webSearch && typeof webSearch === "object" && !Array.isArray(webSearch)) {
    return webSearch as SearchConfigRecord;
  }
  return config;
}

function resolveDefaultString(config: SearchConfigRecord | undefined, key: string): string | undefined {
  const value = config?.[key];
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function resolveDefaultSafeSearch(config: SearchConfigRecord | undefined): "active" | "off" {
  return resolveDefaultString(config, "safeSearch") === "off" ? "off" : DEFAULT_SAFE_SEARCH;
}

function resolveSummary(response: SerpApiResponse): string | undefined {
  const answer = response.answer_box?.answer?.trim();
  if (answer) return answer;

  const snippet = response.answer_box?.snippet?.trim();
  if (snippet) return snippet;

  const highlighted = response.answer_box?.snippet_highlighted_words?.find(
    (value) => typeof value === "string" && value.trim(),
  );
  if (highlighted) return highlighted.trim();

  const description = response.knowledge_graph?.description?.trim();
  if (description) return description;

  return undefined;
}

function buildQuery(query: string, site?: string): string {
  const trimmedSite = site?.trim();
  if (!trimmedSite) return query;
  return `site:${trimmedSite} ${query}`.trim();
}

async function runGoogleSearch(params: {
  query: string;
  count?: number;
  location?: string;
  country?: string;
  language?: string;
  site?: string;
  safeSearch?: "active" | "off";
  searchConfig?: SearchConfigRecord;
  apiKey?: string;
}) {
  const apiKey = params.apiKey?.trim();
  if (!apiKey) {
    throw new Error("Missing SerpApi credential for the Google web search provider.");
  }

  const config = resolveGoogleWebSearchConfig(params.searchConfig);
  const count = resolveSearchCount(
    params.count ?? readNumberParam(config ?? {}, "count", { integer: true }),
    5,
  );
  const location = params.location ?? resolveDefaultString(config, "location");
  const country = (params.country ?? resolveDefaultString(config, "country"))?.toLowerCase();
  const language = (params.language ?? resolveDefaultString(config, "language"))?.toLowerCase();
  const safeSearch = params.safeSearch ?? resolveDefaultSafeSearch(config);
  const timeoutSeconds = resolveSearchTimeoutSeconds(config);
  const cacheTtlMs = resolveSearchCacheTtlMs(config);
  const finalQuery = buildQuery(params.query, params.site);
  const cacheKey = buildSearchCacheKey([
    PROVIDER_ID,
    finalQuery,
    count,
    location ?? "",
    country ?? "",
    language ?? "",
    safeSearch,
  ]);
  const cached = readCachedSearchPayload(cacheKey);
  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const url = new URL(SERP_API_ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("q", finalQuery);
  url.searchParams.set("num", String(count));
  url.searchParams.set("safe", safeSearch);
  if (location) url.searchParams.set("location", location);
  if (country) url.searchParams.set("gl", country);
  if (language) url.searchParams.set("hl", language);

  const startedAt = Date.now();
  const response = (await withTrustedWebSearchEndpoint(
    {
      url: url.toString(),
      timeoutSeconds,
      init: {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    },
    async (result) => {
      if (!result.ok) {
        const detail = (await readResponseText(result, { maxBytes: 64_000 })).text;
        throw new Error(`SerpApi search error (${result.status}): ${detail || result.statusText}`);
      }
      return (await result.json()) as SerpApiResponse;
    },
  )) as SerpApiResponse;

  if (response.error) {
    throw new Error(`SerpApi search error: ${response.error}`);
  }

  const results = Array.isArray(response.organic_results)
    ? response.organic_results
        .filter((entry) => typeof entry.title === "string" && typeof entry.link === "string")
        .slice(0, count)
        .map((entry) => ({
          title: wrapWebContent(entry.title!.trim(), "web_search"),
          url: entry.link!.trim(),
          snippet: entry.snippet ? wrapWebContent(entry.snippet.trim(), "web_search") : "",
          siteName: resolveSiteName(entry.link!.trim()) || undefined,
        }))
    : [];

  const payload = {
    query: params.query,
    provider: PROVIDER_ID,
    count: results.length,
    tookMs: Date.now() - startedAt,
    totalResults: response.search_information?.total_results,
    summary: resolveSummary(response),
    externalContent: {
      untrusted: true,
      source: "web_search",
      provider: PROVIDER_ID,
      wrapped: true,
    },
    results,
  };
  writeCachedSearchPayload(cacheKey, payload, cacheTtlMs);
  return payload;
}

function createGoogleWebSearchProvider() {
  return {
    id: PROVIDER_ID,
    label: "Google Search",
    hint: "Requires SerpApi API key and returns Google organic search results",
    credentialLabel: "SerpApi API key",
    envVars: ["SERPAPI_API_KEY"],
    placeholder: "your-serpapi-key",
    signupUrl: "https://serpapi.com/manage-api-key",
    docsUrl: "https://serpapi.com/search-api",
    autoDetectOrder: 45,
    credentialPath: "plugins.entries.google.config.webSearch.apiKey",
    inactiveSecretPaths: ["plugins.entries.google.config.webSearch.apiKey"],
    getCredentialValue: (searchConfig: SearchConfigRecord | undefined) =>
      getScopedCredentialValue(searchConfig, PROVIDER_ID),
    setCredentialValue: (searchConfigTarget: SearchConfigRecord, value: unknown) =>
      setScopedCredentialValue(searchConfigTarget, PROVIDER_ID, value),
    getConfiguredCredentialValue: (config: SearchConfigRecord | undefined) =>
      resolveProviderWebSearchPluginConfig(config as any, PROVIDER_ID)?.apiKey,
    setConfiguredCredentialValue: (configTarget: SearchConfigRecord, value: unknown) => {
      setProviderWebSearchPluginConfigValue(configTarget as any, PROVIDER_ID, "apiKey", value);
    },
    applySelectionConfig: (config: SearchConfigRecord) => enablePluginInConfig(config as any, PROVIDER_ID).config,
    createTool: (ctx: {
      config?: SearchConfigRecord;
      searchConfig?: SearchConfigRecord;
    }) => ({
      description:
        "Search the web using Google through SerpApi. Returns titles, URLs, snippets, and an optional summary.",
      parameters: GoogleSearchSchema,
      execute: async (args: Record<string, unknown>) => {
        const providerConfig = resolveProviderWebSearchPluginConfig(
          ctx.config as any,
          PROVIDER_ID,
        ) as SearchConfigRecord | undefined;
        const searchConfig = {
          ...(providerConfig ?? {}),
          ...(ctx.searchConfig ?? {}),
          ...(mergeScopedSearchConfig(ctx.searchConfig, PROVIDER_ID, providerConfig) ?? {}),
        };
        const apiKey = resolveWebSearchProviderCredential({
          credentialValue:
            getScopedCredentialValue(ctx.searchConfig, PROVIDER_ID) ??
            getScopedCredentialValue(searchConfig, PROVIDER_ID) ??
            providerConfig?.apiKey,
          path: "plugins.entries.google.config.webSearch.apiKey",
          envVars: ["SERPAPI_API_KEY"],
        });

        return await runGoogleSearch({
          query: readStringParam(args, "query", { required: true }),
          count: readNumberParam(args, "count", { integer: true }),
          location: readStringParam(args, "location"),
          country: readStringParam(args, "country"),
          language: readStringParam(args, "language"),
          site: readStringParam(args, "site"),
          safeSearch: readStringParam(args, "safeSearch") as "active" | "off" | undefined,
          searchConfig,
          apiKey,
        });
      },
    }),
  };
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "Google",
  description: "Google web search provider powered by SerpApi",
  register(api) {
    api.registerWebSearchProvider(createGoogleWebSearchProvider());
  },
});
