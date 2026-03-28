import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { formatDnsRecord, formatDnsRecordList, formatZoneList } from "./format.js";
import { CloudflareStore } from "./store.js";

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

const dnsRecordTypeSchema = Type.Union([
  Type.Literal("A"),
  Type.Literal("AAAA"),
  Type.Literal("CNAME"),
  Type.Literal("TXT"),
  Type.Literal("MX"),
]);

export default definePluginEntry({
  id: "cloudflare",
  name: "Cloudflare",
  description: "Manage Cloudflare zones, DNS records, and cache purge operations inside OpenClaw",
  register(api) {
    const store = new CloudflareStore(api.pluginConfig ?? {});

    api.registerTool({
      name: "cloudflare_list_zones",
      label: "List Cloudflare zones",
      description: "List Cloudflare zones filtered by account, name, or lifecycle status",
      parameters: Type.Object({
        accountId: Type.Optional(Type.String({ minLength: 1 })),
        name: Type.Optional(Type.String({ minLength: 1 })),
        status: Type.Optional(
          Type.Union([
            Type.Literal("active"),
            Type.Literal("pending"),
            Type.Literal("initializing"),
            Type.Literal("moved"),
            Type.Literal("deleted"),
          ]),
        ),
        perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      }),
      async execute(_id, params) {
        const zones = await store.listZones(params);
        return toolTextResult(formatZoneList("Matching zones", zones), {
          status: "ok",
          count: zones.length,
          zones,
        });
      },
    });

    api.registerTool({
      name: "cloudflare_list_dns_records",
      label: "List DNS records",
      description: "List DNS records in a Cloudflare zone filtered by type, name, content, or proxied status",
      parameters: Type.Object({
        zoneId: Type.Optional(Type.String({ minLength: 1 })),
        type: Type.Optional(dnsRecordTypeSchema),
        name: Type.Optional(Type.String({ minLength: 1 })),
        content: Type.Optional(Type.String({ minLength: 1 })),
        proxied: Type.Optional(Type.Boolean()),
        perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
      }),
      async execute(_id, params) {
        const records = await store.listDnsRecords(params);
        return toolTextResult(formatDnsRecordList("Matching DNS records", records), {
          status: "ok",
          count: records.length,
          records,
        });
      },
    });

    api.registerTool({
      name: "cloudflare_upsert_dns_record",
      label: "Upsert DNS record",
      description: "Create a DNS record or update an existing exact-match record in a Cloudflare zone",
      parameters: Type.Object({
        zoneId: Type.Optional(Type.String({ minLength: 1 })),
        recordId: Type.Optional(Type.String({ minLength: 1 })),
        type: dnsRecordTypeSchema,
        name: Type.String({ minLength: 1 }),
        content: Type.String({ minLength: 1 }),
        ttl: Type.Optional(Type.Integer({ minimum: 1, maximum: 86400 })),
        proxied: Type.Optional(Type.Boolean()),
        priority: Type.Optional(Type.Integer({ minimum: 0 })),
        comment: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
      }),
      async execute(_id, params) {
        const result = await store.upsertDnsRecord(params);
        return toolTextResult(`DNS record ${result.action}.\n${formatDnsRecord(result.record)}`, {
          status: result.action,
          record: result.record,
        });
      },
    });

    api.registerTool({
      name: "cloudflare_delete_dns_record",
      label: "Delete DNS record",
      description: "Delete a DNS record by record id or by exact zone, type, and name match",
      parameters: Type.Object({
        zoneId: Type.Optional(Type.String({ minLength: 1 })),
        recordId: Type.Optional(Type.String({ minLength: 1 })),
        type: Type.Optional(dnsRecordTypeSchema),
        name: Type.Optional(Type.String({ minLength: 1 })),
      }),
      async execute(_id, params) {
        const result = await store.deleteDnsRecord(params);
        return toolTextResult(`DNS record deleted: ${result.recordId}`, {
          status: "deleted",
          zoneId: result.zoneId,
          recordId: result.recordId,
        });
      },
    });

    api.registerTool({
      name: "cloudflare_purge_cache",
      label: "Purge Cloudflare cache",
      description: "Purge the full cache for a zone or only a specific set of file URLs",
      parameters: Type.Object({
        zoneId: Type.Optional(Type.String({ minLength: 1 })),
        everything: Type.Optional(Type.Boolean()),
        files: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
      }),
      async execute(_id, params) {
        const result = await store.purgeCache(params);
        const text =
          result.mode === "everything"
            ? `Cache purged for the full zone: ${result.zoneId}`
            : `Cache purged for ${result.fileCount} file(s) in zone ${result.zoneId}`;

        return toolTextResult(text, {
          status: "purged",
          zoneId: result.zoneId,
          mode: result.mode,
          fileCount: result.fileCount,
        });
      },
    });
  },
});
