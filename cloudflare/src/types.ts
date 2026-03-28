export type CloudflareZoneStatus = "active" | "pending" | "initializing" | "moved" | "deleted";
export type CloudflareDnsRecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX";

export interface CloudflarePluginConfig {
  apiToken?: string;
  defaultZoneId?: string;
  defaultAccountId?: string;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  accountId?: string;
  accountName?: string;
  nameServers: string[];
  paused?: boolean;
}

export interface CloudflareDnsRecord {
  id: string;
  zoneId: string;
  zoneName?: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
  tags: string[];
  createdAt?: string;
  modifiedAt?: string;
}

export interface ListZonesInput {
  accountId?: string;
  name?: string;
  status?: CloudflareZoneStatus;
  perPage?: number;
}

export interface ListDnsRecordsInput {
  zoneId?: string;
  type?: CloudflareDnsRecordType;
  name?: string;
  content?: string;
  proxied?: boolean;
  perPage?: number;
}

export interface UpsertDnsRecordInput {
  zoneId?: string;
  recordId?: string;
  type: CloudflareDnsRecordType;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  comment?: string;
  tags?: string[];
}

export interface DeleteDnsRecordInput {
  zoneId?: string;
  recordId?: string;
  type?: CloudflareDnsRecordType;
  name?: string;
}

export interface PurgeCacheInput {
  zoneId?: string;
  everything?: boolean;
  files?: string[];
}

export interface CloudflareApiEnvelope<T> {
  success: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result: T;
}
