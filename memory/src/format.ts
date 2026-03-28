import type { Memory } from "./types.js";

export function formatMemory(memory: Memory): string {
  const parts = [
    `${memory.id}: ${memory.summary}`,
    `status=${memory.status}`,
    `importance=${memory.importance}`,
  ];

  if (memory.topic) {
    parts.push(`topic=${memory.topic}`);
  }
  if (memory.pinned) {
    parts.push("pinned=yes");
  }
  if (memory.tags.length) {
    parts.push(`tags=${memory.tags.join(", ")}`);
  }
  if (memory.observations.length) {
    parts.push(`observations=${memory.observations.length}`);
  }
  if (memory.lastRecalledAt) {
    parts.push(`recalled=${memory.lastRecalledAt}`);
  }

  return parts.join(" | ");
}

export function formatMemoryList(label: string, memories: Memory[]): string {
  if (!memories.length) {
    return `${label}: none`;
  }
  return `${label}:\n${memories.map((memory) => `- ${formatMemory(memory)}`).join("\n")}`;
}
