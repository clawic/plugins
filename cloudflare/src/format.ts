import type { CloudflareDnsRecord, CloudflareZone } from "./types.js";

export function formatZone(zone: CloudflareZone): string {
  const parts = [`${zone.id}: ${zone.name}`, `status=${zone.status}`];

  if (zone.accountName) {
    parts.push(`account=${zone.accountName}`);
  }
  if (zone.paused !== undefined) {
    parts.push(`paused=${zone.paused ? "yes" : "no"}`);
  }
  if (zone.nameServers.length) {
    parts.push(`nameservers=${zone.nameServers.join(", ")}`);
  }

  return parts.join(" | ");
}

export function formatZoneList(label: string, zones: CloudflareZone[]): string {
  if (!zones.length) {
    return `${label}: none`;
  }
  return `${label}:\n${zones.map((zone) => `- ${formatZone(zone)}`).join("\n")}`;
}

export function formatDnsRecord(record: CloudflareDnsRecord): string {
  const parts = [
    `${record.id}: ${record.type} ${record.name} -> ${record.content}`,
    `ttl=${record.ttl}`,
  ];

  if (record.zoneName) {
    parts.push(`zone=${record.zoneName}`);
  }
  if (record.proxied !== undefined) {
    parts.push(`proxied=${record.proxied ? "yes" : "no"}`);
  }
  if (record.priority !== undefined) {
    parts.push(`priority=${record.priority}`);
  }
  if (record.tags.length) {
    parts.push(`tags=${record.tags.join(", ")}`);
  }
  if (record.comment) {
    parts.push(`comment=${record.comment}`);
  }

  return parts.join(" | ");
}

export function formatDnsRecordList(label: string, records: CloudflareDnsRecord[]): string {
  if (!records.length) {
    return `${label}: none`;
  }
  return `${label}:\n${records.map((record) => `- ${formatDnsRecord(record)}`).join("\n")}`;
}
