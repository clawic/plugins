import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AddResourceInput,
  AddSynthesisInput,
  CreateResearchInput,
  DeepResearchPluginConfig,
  DeepResearchStoreFile,
  ListResearchInput,
  Research,
  ResearchConfidence,
  ResearchPhase,
  ResearchResource,
  ResearchSourceType,
  ResearchStatus,
  ResearchSynthesis,
  UpdateResearchInput,
} from "./types.js";

const EMPTY_STORE: DeepResearchStoreFile = {
  version: 1,
  researches: [],
};

export class DeepResearchStore {
  private readonly storagePath: string;

  constructor(config: DeepResearchPluginConfig = {}) {
    this.storagePath = resolveStoragePath(config.storagePath);
  }

  async createResearch(input: CreateResearchInput): Promise<Research> {
    assertNonEmpty(input.title, "title");
    assertNonEmpty(input.question, "question");
    const now = new Date().toISOString();
    const store = await this.load();

    const research: Research = {
      id: createId("rsr"),
      title: input.title.trim(),
      question: input.question.trim(),
      objective: normalizeOptionalString(input.objective),
      scope: normalizeOptionalString(input.scope),
      tags: normalizeTags(input.tags),
      status: "active",
      phase: input.phase ?? "framing",
      resources: [],
      syntheses: [],
      createdAt: now,
      updatedAt: now,
    };

    store.researches.push(research);
    if (input.setActive ?? true) {
      store.activeResearchId = research.id;
    }
    await this.save(store);
    return research;
  }

  async listResearch(input: ListResearchInput = {}): Promise<Research[]> {
    const store = await this.load();
    const researches = filterResearch(store.researches, input);
    sortResearch(researches, store.activeResearchId);
    return researches.slice(0, normalizeLimit(input.limit));
  }

  async getResearch(researchId?: string): Promise<Research> {
    const store = await this.load();
    const resolvedResearchId = resolveResearchId(store, researchId);
    return findResearch(store.researches, resolvedResearchId);
  }

  async getActiveResearchId(): Promise<string | undefined> {
    const store = await this.load();
    return store.activeResearchId;
  }

  async updateResearch(input: UpdateResearchInput): Promise<Research> {
    const store = await this.load();
    const research = findResearch(store.researches, input.researchId);

    if (input.title !== undefined) {
      assertNonEmpty(input.title, "title");
      research.title = input.title.trim();
    }
    if (input.question !== undefined) {
      assertNonEmpty(input.question, "question");
      research.question = input.question.trim();
    }
    if (input.objective !== undefined) {
      research.objective = normalizeNullableString(input.objective);
    }
    if (input.scope !== undefined) {
      research.scope = normalizeNullableString(input.scope);
    }
    if (input.tags !== undefined) {
      research.tags = normalizeTags(input.tags);
    }
    if (input.addTags?.length) {
      research.tags = normalizeTags([...research.tags, ...input.addTags]);
    }
    if (input.removeTags?.length) {
      const remove = new Set(input.removeTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
      research.tags = research.tags.filter((tag) => !remove.has(tag.toLowerCase()));
    }
    if (input.phase !== undefined) {
      research.phase = input.phase;
    }
    if (input.status !== undefined) {
      research.status = input.status;
      if (input.status === "completed") {
        research.completedAt = new Date().toISOString();
        research.archivedAt = undefined;
      } else if (input.status === "archived") {
        research.archivedAt = new Date().toISOString();
        if (store.activeResearchId === research.id) {
          store.activeResearchId = undefined;
        }
      } else {
        research.completedAt = undefined;
        research.archivedAt = undefined;
      }
    }

    research.updatedAt = new Date().toISOString();
    await this.save(store);
    return research;
  }

  async focusResearch(researchId: string): Promise<Research> {
    const store = await this.load();
    const research = findResearch(store.researches, researchId);
    if (research.status === "archived") {
      throw new Error(`Cannot focus archived research: ${researchId}`);
    }
    store.activeResearchId = research.id;
    research.updatedAt = new Date().toISOString();
    await this.save(store);
    return research;
  }

  async addResource(input: AddResourceInput): Promise<{ research: Research; resource: ResearchResource }> {
    assertNonEmpty(input.title, "title");
    const store = await this.load();
    const research = findResearch(store.researches, resolveResearchId(store, input.researchId));
    const now = new Date().toISOString();

    const resource: ResearchResource = {
      id: createId("res"),
      title: input.title.trim(),
      url: normalizeOptionalString(input.url),
      sourceType: normalizeSourceType(input.sourceType),
      summary: normalizeOptionalString(input.summary),
      notes: normalizeOptionalString(input.notes),
      author: normalizeOptionalString(input.author),
      publishedAt: normalizeOptionalString(input.publishedAt),
      capturedAt: now,
    };

    research.resources.push(resource);
    research.updatedAt = now;
    await this.save(store);
    return { research, resource };
  }

  async addSynthesis(input: AddSynthesisInput): Promise<{ research: Research; synthesis: ResearchSynthesis }> {
    assertNonEmpty(input.title, "title");
    assertNonEmpty(input.body, "body");
    const store = await this.load();
    const research = findResearch(store.researches, resolveResearchId(store, input.researchId));
    const now = new Date().toISOString();

    const synthesis: ResearchSynthesis = {
      id: createId("syn"),
      phase: input.phase ?? research.phase,
      title: input.title.trim(),
      body: input.body.trim(),
      confidence: normalizeConfidence(input.confidence),
      openQuestions: normalizeList(input.openQuestions),
      nextSteps: normalizeList(input.nextSteps),
      createdAt: now,
    };

    research.syntheses.push(synthesis);
    research.updatedAt = now;
    if (input.phase) {
      research.phase = input.phase;
    }
    await this.save(store);
    return { research, synthesis };
  }

  async inspectRaw(): Promise<DeepResearchStoreFile> {
    return this.load();
  }

  private async load(): Promise<DeepResearchStoreFile> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DeepResearchStoreFile>;
      return {
        version: 1,
        activeResearchId:
          typeof parsed.activeResearchId === "string" && parsed.activeResearchId.trim()
            ? parsed.activeResearchId
            : undefined,
        researches: Array.isArray(parsed.researches) ? parsed.researches : [],
      };
    } catch (error) {
      if (isNotFound(error)) {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async save(store: DeepResearchStoreFile): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const tempPath = `${this.storagePath}.tmp`;
    const content = JSON.stringify(store, null, 2);
    await writeFile(tempPath, `${content}\n`, "utf8");
    await rename(tempPath, this.storagePath);
  }
}

function filterResearch(researches: Research[], input: ListResearchInput): Research[] {
  const query = input.search?.trim().toLowerCase();

  return researches.filter((research) => {
    if (!input.includeArchived && research.status === "archived") {
      return false;
    }
    if (input.status && research.status !== input.status) {
      return false;
    }
    if (input.phase && research.phase !== input.phase) {
      return false;
    }
    if (input.tag && !research.tags.includes(input.tag)) {
      return false;
    }
    if (query) {
      const haystack = [research.title, research.question, research.objective, research.scope, ...research.tags]
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

function sortResearch(researches: Research[], activeResearchId?: string): void {
  researches.sort((left, right) => {
    if (left.id === activeResearchId && right.id !== activeResearchId) {
      return -1;
    }
    if (right.id === activeResearchId && left.id !== activeResearchId) {
      return 1;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function resolveResearchId(store: DeepResearchStoreFile, researchId?: string): string {
  if (researchId?.trim()) {
    return researchId;
  }
  if (store.activeResearchId) {
    return store.activeResearchId;
  }
  throw new Error("No researchId provided and no active research is set.");
}

function findResearch(researches: Research[], researchId: string): Research {
  const research = researches.find((candidate) => candidate.id === researchId);
  if (!research) {
    throw new Error(`Research not found: ${researchId}`);
  }
  return research;
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableString(value?: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  return normalizeOptionalString(value ?? undefined);
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeList(values?: string[]): string[] {
  if (!values) {
    return [];
  }
  return values.map((value) => value.trim()).filter(Boolean);
}

function normalizeSourceType(value?: ResearchSourceType): ResearchSourceType {
  return value ?? "web";
}

function normalizeConfidence(value?: ResearchConfidence): ResearchConfidence {
  return value ?? "medium";
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

function resolveStoragePath(customPath?: string): string {
  if (!customPath) {
    return path.join(os.homedir(), ".openclaw", "state", "deep-research", "research.json");
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
    throw new Error(`${field} must not be empty`);
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
