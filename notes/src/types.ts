export type NoteStatus = "active" | "archived";

export interface NoteEntry {
  id: string;
  body: string;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  body?: string;
  notebook?: string;
  tags: string[];
  pinned: boolean;
  status: NoteStatus;
  entries: NoteEntry[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface NoteStoreFile {
  version: 1;
  notes: Note[];
}

export interface NotesPluginConfig {
  storagePath?: string;
  defaultNotebook?: string;
}

export interface CreateNoteInput {
  title: string;
  body?: string;
  notebook?: string;
  tags?: string[];
  pinned?: boolean;
}

export interface ListNotesInput {
  search?: string;
  notebook?: string;
  tag?: string;
  pinned?: boolean;
  includeArchived?: boolean;
  limit?: number;
}

export interface UpdateNoteInput {
  noteId: string;
  title?: string;
  body?: string | null;
  notebook?: string | null;
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  pinned?: boolean;
}

export interface AppendNoteInput {
  noteId: string;
  body: string;
}

export interface DeleteNoteInput {
  noteId: string;
  hardDelete?: boolean;
}
