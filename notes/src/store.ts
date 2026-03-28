import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AppendNoteInput,
  CreateNoteInput,
  DeleteNoteInput,
  ListNotesInput,
  Note,
  NoteEntry,
  NotesPluginConfig,
  NoteStoreFile,
  UpdateNoteInput,
} from "./types.js";

const EMPTY_STORE: NoteStoreFile = {
  version: 1,
  notes: [],
};

export class NoteStore {
  private readonly storagePath: string;
  private readonly config: NotesPluginConfig;

  constructor(config: NotesPluginConfig = {}) {
    this.storagePath = resolveStoragePath(config.storagePath);
    this.config = config;
  }

  async createNote(input: CreateNoteInput): Promise<Note> {
    assertNonEmpty(input.title, "title");
    const now = new Date().toISOString();
    const store = await this.load();

    const note: Note = {
      id: createId("note"),
      title: input.title.trim(),
      body: normalizeOptionalString(input.body),
      notebook: normalizeOptionalString(input.notebook ?? this.config.defaultNotebook),
      tags: normalizeTags(input.tags),
      pinned: input.pinned ?? false,
      status: "active",
      entries: [],
      createdAt: now,
      updatedAt: now,
    };

    store.notes.push(note);
    await this.save(store);
    return note;
  }

  async listNotes(input: ListNotesInput = {}): Promise<Note[]> {
    const store = await this.load();
    const notes = filterNotes(store.notes, input);
    sortNotes(notes);
    return notes.slice(0, normalizeLimit(input.limit));
  }

  async getNote(noteId: string): Promise<Note> {
    const store = await this.load();
    return findNote(store.notes, noteId);
  }

  async updateNote(input: UpdateNoteInput): Promise<Note> {
    const store = await this.load();
    const note = findNote(store.notes, input.noteId);

    if (input.title !== undefined) {
      assertNonEmpty(input.title, "title");
      note.title = input.title.trim();
    }
    if (input.body !== undefined) {
      note.body = normalizeNullableString(input.body);
    }
    if (input.notebook !== undefined) {
      note.notebook = normalizeNullableString(input.notebook);
    }
    if (input.tags !== undefined) {
      note.tags = normalizeTags(input.tags);
    }
    if (input.addTags?.length) {
      note.tags = normalizeTags([...note.tags, ...input.addTags]);
    }
    if (input.removeTags?.length) {
      const remove = new Set(input.removeTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
      note.tags = note.tags.filter((tag) => !remove.has(tag.toLowerCase()));
    }
    if (input.pinned !== undefined) {
      note.pinned = input.pinned;
    }

    note.updatedAt = new Date().toISOString();
    await this.save(store);
    return note;
  }

  async appendToNote(input: AppendNoteInput): Promise<Note> {
    assertNonEmpty(input.body, "body");
    const store = await this.load();
    const note = findNote(store.notes, input.noteId);
    const now = new Date().toISOString();

    note.entries.push(createEntry(input.body, now));
    note.updatedAt = now;
    await this.save(store);
    return note;
  }

  async deleteNote(input: DeleteNoteInput): Promise<{ noteId: string; deleted: "archived" | "removed" }> {
    const store = await this.load();
    const index = store.notes.findIndex((note) => note.id === input.noteId);
    if (index === -1) {
      throw new Error(`Note not found: ${input.noteId}`);
    }

    if (input.hardDelete) {
      store.notes.splice(index, 1);
      await this.save(store);
      return { noteId: input.noteId, deleted: "removed" };
    }

    const now = new Date().toISOString();
    store.notes[index].status = "archived";
    store.notes[index].archivedAt = now;
    store.notes[index].updatedAt = now;
    await this.save(store);
    return { noteId: input.noteId, deleted: "archived" };
  }

  async inspectRaw(): Promise<NoteStoreFile> {
    return this.load();
  }

  private async load(): Promise<NoteStoreFile> {
    try {
      const raw = await readFile(this.storagePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<NoteStoreFile>;
      return {
        version: 1,
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      };
    } catch (error) {
      if (isNotFound(error)) {
        return structuredClone(EMPTY_STORE);
      }
      throw error;
    }
  }

  private async save(store: NoteStoreFile): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
    const tempPath = `${this.storagePath}.tmp`;
    const content = JSON.stringify(store, null, 2);
    await writeFile(tempPath, `${content}\n`, "utf8");
    await rename(tempPath, this.storagePath);
  }
}

function filterNotes(notes: Note[], input: ListNotesInput): Note[] {
  const query = input.search?.trim().toLowerCase();

  return notes.filter((note) => {
    if (!input.includeArchived && note.status === "archived") {
      return false;
    }
    if (input.notebook && note.notebook !== input.notebook) {
      return false;
    }
    if (input.tag && !note.tags.includes(input.tag)) {
      return false;
    }
    if (input.pinned !== undefined && note.pinned !== input.pinned) {
      return false;
    }
    if (query) {
      const haystack = [note.title, note.body, note.notebook, ...note.tags, ...note.entries.map((entry) => entry.body)]
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

function sortNotes(notes: Note[]): void {
  notes.sort((left, right) => {
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

function createEntry(body: string, createdAt: string): NoteEntry {
  assertNonEmpty(body, "entry body");
  return {
    id: createId("entry"),
    body: body.trim(),
    createdAt,
  };
}

function findNote(notes: Note[], noteId: string): Note {
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }
  return note;
}

function resolveStoragePath(customPath?: string): string {
  if (!customPath) {
    return path.join(os.homedir(), ".openclaw", "state", "notes", "notes.json");
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
