import type {
  CloudflareApiEnvelope,
  CloudflareDnsRecord,
  CloudflarePluginConfig,
  CloudflareZone,
  DeleteDnsRecordInput,
  ListDnsRecordsInput,
  ListZonesInput,
  PurgeCacheInput,
  UpsertDnsRecordInput,
} from "./types.js";

const CLOUDFLARE_API_BASE_URL = "https://api.cloudflare.com/client/v4";

type FetchLike = typeof fetch;

export class CloudflareStore {
  private readonly apiToken: string;
  private readonly defaultZoneId?: string;
  private readonly defaultAccountId?: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: CloudflarePluginConfig = {}, fetchImpl: FetchLike = fetch) {
    this.apiToken = config.apiToken?.trim() ?? "";
    this.defaultZoneId = normalizeOptionalString(config.defaultZoneId);
    this.defaultAccountId = normalizeOptionalString(config.defaultAccountId);
    this.fetchImpl = fetchImpl;

    if (!this.apiToken) {
      throw new Error("Cloudflare apiToken is required.");
    }
  }

  async listZones(input: ListZonesInput = {}): Promise<CloudflareZone[]> {
    const query = new URLSearchParams();
    const accountId = normalizeOptionalString(input.accountId ?? this.defaultAccountId);
    const name = normalizeOptionalString(input.name);
    const status = normalizeOptionalString(input.status);
    const perPage = normalizePerPage(input.perPage);

    if (accountId) {
      query.set("account.id", accountId);
    }
    if (name) {
      query.set("name", name);
    }
    if (status) {
      query.set("status", status);
    }
    if (perPage !== undefined) {
      query.set("per_page", String(perPage));
    }

    const response = await this.request<Array<Record<string, unknown>>>(
      `/zones${query.size ? `?${query.toString()}` : ""}`,
    );

    return response.map(mapZone);
  }

  async listDnsRecords(input: ListDnsRecordsInput = {}): Promise<CloudflareDnsRecord[]> {
    const zoneId = this.resolveZoneId(input.zoneId);
    const query = new URLSearchParams();
    const type = normalizeOptionalString(input.type);
    const name = normalizeOptionalString(input.name);
    const content = normalizeOptionalString(input.content);
    const perPage = normalizePerPage(input.perPage);

    if (type) {
      query.set("type", type);
    }
    if (name) {
      query.set("name", name);
    }
    if (content) {
      query.set("content", content);
    }
    if (input.proxied !== undefined) {
      query.set("proxied", String(input.proxied));
    }
    if (perPage !== undefined) {
      query.set("per_page", String(perPage));
    }

    const response = await this.request<Array<Record<string, unknown>>>(
      `/zones/${zoneId}/dns_records${query.size ? `?${query.toString()}` : ""}`,
    );

    return response.map((record) => mapDnsRecord(record, zoneId));
  }

  async upsertDnsRecord(input: UpsertDnsRecordInput): Promise<{ action: "created" | "updated"; record: CloudflareDnsRecord }> {
    const zoneId = this.resolveZoneId(input.zoneId);
    assertNonEmpty(input.type, "type");
    assertNonEmpty(input.name, "name");
    assertNonEmpty(input.content, "content");

    const payload = {
      type: input.type,
      name: input.name.trim(),
      content: input.content.trim(),
      ttl: normalizeTtl(input.ttl),
      proxied: input.proxied,
      priority: input.priority,
      comment: normalizeOptionalString(input.comment),
      tags: normalizeTags(input.tags),
    };

    if (input.recordId) {
      const response = await this.request<Record<string, unknown>>(`/zones/${zoneId}/dns_records/${input.recordId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      return {
        action: "updated",
        record: mapDnsRecord(response, zoneId),
      };
    }

    const matches = await this.listDnsRecords({
      zoneId,
      type: input.type,
      name: input.name,
      perPage: 100,
    });
    const exactMatches = matches.filter((record) => record.name === input.name.trim());

    if (exactMatches.length > 1) {
      throw new Error(
        `Multiple DNS records match ${input.type} ${input.name.trim()}. Pass recordId to update the intended record.`,
      );
    }

    if (exactMatches.length === 1) {
      const response = await this.request<Record<string, unknown>>(
        `/zones/${zoneId}/dns_records/${exactMatches[0].id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      return {
        action: "updated",
        record: mapDnsRecord(response, zoneId),
      };
    }

    const response = await this.request<Record<string, unknown>>(`/zones/${zoneId}/dns_records`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      action: "created",
      record: mapDnsRecord(response, zoneId),
    };
  }

  async deleteDnsRecord(input: DeleteDnsRecordInput): Promise<{ zoneId: string; recordId: string }> {
    const zoneId = this.resolveZoneId(input.zoneId);
    const recordId = input.recordId?.trim() || (await this.resolveRecordId(zoneId, input));

    await this.request<Record<string, unknown>>(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: "DELETE",
    });

    return { zoneId, recordId };
  }

  async purgeCache(input: PurgeCacheInput): Promise<{ zoneId: string; mode: "everything" | "files"; fileCount: number }> {
    const zoneId = this.resolveZoneId(input.zoneId);
    const files = normalizeFiles(input.files);

    if (input.everything) {
      await this.request<Record<string, unknown>>(`/zones/${zoneId}/purge_cache`, {
        method: "POST",
        body: JSON.stringify({ purge_everything: true }),
      });
      return { zoneId, mode: "everything", fileCount: 0 };
    }

    if (!files.length) {
      throw new Error("purgeCache requires everything=true or at least one file URL.");
    }

    await this.request<Record<string, unknown>>(`/zones/${zoneId}/purge_cache`, {
      method: "POST",
      body: JSON.stringify({ files }),
    });

    return { zoneId, mode: "files", fileCount: files.length };
  }

  private async resolveRecordId(zoneId: string, input: DeleteDnsRecordInput): Promise<string> {
    assertNonEmpty(input.type, "type");
    assertNonEmpty(input.name, "name");

    const matches = await this.listDnsRecords({
      zoneId,
      type: input.type,
      name: input.name,
      perPage: 100,
    });
    const exactMatches = matches.filter((record) => record.name === input.name?.trim());

    if (exactMatches.length === 0) {
      throw new Error(`DNS record not found: ${input.type} ${input.name?.trim()}`);
    }
    if (exactMatches.length > 1) {
      throw new Error(`Multiple DNS records match ${input.type} ${input.name?.trim()}. Pass recordId instead.`);
    }

    return exactMatches[0].id;
  }

  private resolveZoneId(zoneId?: string): string {
    const resolved = normalizeOptionalString(zoneId ?? this.defaultZoneId);
    if (!resolved) {
      throw new Error("zoneId is required when defaultZoneId is not configured.");
    }
    return resolved;
  }

  private async request<T>(requestPath: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${this.apiToken}`);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchImpl(`${CLOUDFLARE_API_BASE_URL}${requestPath}`, {
      ...init,
      headers,
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as CloudflareApiEnvelope<T>) : null;

    if (!response.ok) {
      throw new Error(buildCloudflareError(parsed?.errors, response.statusText || `HTTP ${response.status}`));
    }
    if (!parsed?.success) {
      throw new Error(buildCloudflareError(parsed?.errors, "Cloudflare request failed."));
    }

    return parsed.result;
  }
}

function mapZone(input: Record<string, unknown>): CloudflareZone {
  const account = asRecord(input.account);

  return {
    id: asString(input.id),
    name: asString(input.name),
    status: asString(input.status),
    accountId: optionalString(account.id),
    accountName: optionalString(account.name),
    nameServers: asStringArray(input.name_servers),
    paused: typeof input.paused === "boolean" ? input.paused : undefined,
  };
}

function mapDnsRecord(input: Record<string, unknown>, fallbackZoneId: string): CloudflareDnsRecord {
  return {
    id: asString(input.id),
    zoneId: optionalString(input.zone_id) ?? fallbackZoneId,
    zoneName: optionalString(input.zone_name),
    type: asString(input.type),
    name: asString(input.name),
    content: asString(input.content),
    ttl: asNumber(input.ttl),
    proxied: typeof input.proxied === "boolean" ? input.proxied : undefined,
    priority: typeof input.priority === "number" ? input.priority : undefined,
    comment: optionalString(input.comment),
    tags: asStringArray(input.tags),
    createdAt: optionalString(input.created_on),
    modifiedAt: optionalString(input.modified_on),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Cloudflare response missing required string field.");
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("Cloudflare response missing required numeric field.");
  }
  return value;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizePerPage(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("perPage must be an integer between 1 and 100.");
  }
  return value;
}

function normalizeTtl(value?: number): number {
  if (value === undefined) {
    return 1;
  }
  if (!Number.isInteger(value) || value < 1 || value > 86400) {
    throw new Error("ttl must be an integer between 1 and 86400.");
  }
  return value;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeFiles(files?: string[]): string[] {
  if (!files) {
    return [];
  }
  return [...new Set(files.map((file) => file.trim()).filter(Boolean))];
}

function assertNonEmpty(value: string | undefined, field: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
}

function buildCloudflareError(errors: Array<{ code?: number; message?: string }> | undefined, fallback: string): string {
  if (!errors?.length) {
    return fallback;
  }

  return errors
    .map((error) => {
      const message = error.message?.trim() || fallback;
      return error.code ? `[${error.code}] ${message}` : message;
    })
    .join("; ");
}
