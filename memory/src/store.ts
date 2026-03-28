import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  DeleteMemoryInput,
  Memory,
  MemoryObservation,
  MemoryPluginConfig,
  MemoryStoreFile,
  RecallMemoriesInput,
  ReinforceMemoryInput,
  RememberMemoryInput,
  UpdateMemoryInput,
} from "./types.js";

const EMPTY_STORE: MemoryStoreFile = {
  version: 1,
  memories: [],
};

export class MemoryStore {
  private readonly storagePath: string;
  private readonly config: MemoryPluginConfig;

  constructor(config: MemoryPluginConfig = {}) {
    this.storagePath = resolveStoragePath(config.storagePath);
    this.config = config;
  }

  async remember(input: RememberMemoryInput): Promise<Memory> {
    assertNonEmpty(input.summary, "summary");
    const now = new Date().toISOString();
    const store = await this.load();

    const memory: Memory = {
      id: createId("mem"),
      summary: input.summary.trim(),
      details: normalizeOptionalString(input.details),
      topic: normalizeOptionalString(input.topic ?? this.config.defaultTopic),
      tags: normalizeTags(input.tags),
      importance: input.importance ?? "medium",
      pinned: input.pinned ?? false,
      status: "active",
      observations: [],
      createdAt: now,
      updatedAt: now,
    };

    store.memories.push(memory);
    await this.save(store);
    return memory;
  }

  async recall(input: RecallMemoriesInput = {}): Promise<Memory[]> {
    const store = await this.load();
    const memories = filterMemories(store.memories, input);
    sortMemories(memories);
    return memories.slice(0, normalizeLimit(input.limit));
  }

  async getMemory(memoryId: string): Promise<Memory> {
    const store = await this.load();
    const memory = findMemory(store.memories, memoryId);
    memory.lastRecalledAt = new Date().toISOString();
    memory.updatedAt = memory.lastRecalledAt;
    await this.save(store);
    return memory;
  }

  async updateMemory(input: UpdateMemoryInput): Promise<Memory> {
    const store = await this.load();
    const memory = findMemory(store.memories, input.memoryId);

    if (input.summary !== undefined) {
      assertNonEmpty(input.summary, "summary");
      memory.summary = input.summary.trim();
    }
    if (input.details !== undefined) {
      memory.details = normalizeNullableString(input.details);
    }
    if (input.topic !== undefined) {
      memory.topic = normalizeNullableString(input.topic);
    }
    if (input.tags !== undefined) {
      memory.tags = normalizeTags(input.tags);
    }
    if (input.addTags?.length) {
      memory.tags = normalizeTags([...memory.tags, ...input.addTags]);
    }
    if (input.removeTags?.length) {
      const remove = new Set(input.removeTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
      memory.tags = memory.tags.filter((tag) => !remove.has(tag.toLowerCase()));
    }
    if (input.importance !== undefined) {
      memory.importance = input.importance;
    }
    if (input.pinned !== undefined) {
      memory.pinned = input.pinned;
    }

    memory.updatedAt = new Date().toISOString();
    await this.save(store);
    return memory;
  }

  async reinforce(input: ReinforceMemoryInput): Promise<Memory> {
    assertNonEmpty(input.body, "body");
    const store = await this.load();
    const memory = findMemory(store.memories, input.memoryId);
    const now = new Date().toISOString();

    memory.observations.push(createObservation(input.body, now));
    memory.updatedAt = now;
    await this.save(store);
    return memory;
  }

  async deleteMemory(input: DeleteMemoryInput): Promise<{ memoryId: string; deleted: "archived" | "removed" }> {
    const store = await this.load();
    const index = store.memories.findIndex((memory) => memory.id === input.memoryId);
    if (index === -1) {
      throw new Error(`Memory not found: ${input.memoryId}`);
    }

    if (input.hardDelete) {
      store.memories.splice(index, 1);
      await this.save(store);
      return { memoryId: input.memoryId, deleted: "removed" };
    }

    const now = new Date().toISOString();
    store.memories[index].status = "archived";
    store.memories[index].archivedAt = now;
    store.memories[index].updatedAt = now;
    await this.save(store);
    return { memoryId: input.memoryId, deleted: "archived" };
  }

  async inspectRaw(): Promise<MemoryStoreFile> {
    return this.load();
  }

  private async load(): Promise<MemoryStoreFile> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<MemoryStoreFile>;
      return {
        version: 1,
        memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      };
    } catch (error) {
      if (isNotFound(error)) {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async save(store: MemoryStoreFile): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const tempPath = `${this.storagePath}.tmp`;
    const content = JSON.stringify(store, null, 2);
    await writeFile(tempPath, `${content}\n`, "utf8");
    await rename(tempPath, this.storagePath);
  }
}

function filterMemories(memories: Memory[], input: RecallMemoriesInput): Memory[] {
  const query = input.search?.trim().toLowerCase();

  return memories.filter((memory) => {
    if (!input.includeArchived && memory.status === "archived") {
      return false;
    }
    if (input.topic && memory.topic !== input.topic) {
      return false;
    }
    if (input.tag && !memory.tags.includes(input.tag)) {
      return false;
    }
    if (input.importance && memory.importance !== input.importance) {
      return false;
    }
    if (input.pinned !== undefined && memory.pinned !== input.pinned) {
      return false;
    }
    if (query) {
      const haystack = [
        memory.summary,
        memory.details,
        memory.topic,
        ...memory.tags,
        ...memory.observations.map((observation) => observation.body),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

function sortMemories(memories: Memory[]): void {
  memories.sort((left, right) => {
    if (left.pinned !== right.pinned) {
      return left.pinned ? -1 : 1;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableString(value?: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  return normalizeOptionalString(value);
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) {
    return 25;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be a positive integer");
  }
  return limit;
}

function createObservation(body: string, createdAt: string): MemoryObservation {
  assertNonEmpty(body, "observation body");
  return {
    id: createId("obs"),
    body: body.trim(),
    createdAt,
  };
}

function findMemory(memories: Memory[], memoryId: string): Memory {
  const memory = memories.find((candidate) => candidate.id === memoryId);
  if (!memory) {
    throw new Error(`Memory not found: ${memoryId}`);
  }
  return memory;
}

function resolveStoragePath(customPath?: string): string {
  if (!customPath) {
    return path.join(os.homedir(), ".openclaw", "state", "memory", "memory.json");
  }
  if (customPath.startsWith("~")) {
    return path.join(os.homedir(), customPath.slice(1));
  }
  return path.resolve(customPath);
}

function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} is required`);
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
