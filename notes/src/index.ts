import { Type } from "@sinclair/typebox";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

import { formatNote, formatNoteList } from "./format.js";
import { NoteStore } from "./store.js";

function toolTextResult(text: string, details: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    details,
  };
}

export default definePluginEntry({
  id: "notes",
  name: "Notes",
  description: "Manage local notes, notebooks, tags, and append-only note history inside OpenClaw",
  register(api) {
    const store = new NoteStore(api.pluginConfig ?? {});

    api.registerTool({
      name: "notes_create",
      label: "Create note",
      description: "Create a note with a title, optional body, notebook, tags, and pinned state",
      parameters: Type.Object({
        title: Type.String({ minLength: 1 }),
        body: Type.Optional(Type.String()),
        notebook: Type.Optional(Type.String()),
        tags: Type.Optional(Type.Array(Type.String())),
        pinned: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const note = await store.createNote(params);
        return toolTextResult(`Note created.\n${formatNote(note)}`, {
          status: "created",
          note,
        });
      },
    });

    api.registerTool({
      name: "notes_list",
      label: "List notes",
      description: "List notes by search query, notebook, tag, pinned state, or archive visibility",
      parameters: Type.Object({
        search: Type.Optional(Type.String()),
        notebook: Type.Optional(Type.String()),
        tag: Type.Optional(Type.String()),
        pinned: Type.Optional(Type.Boolean()),
        includeArchived: Type.Optional(Type.Boolean()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
      }),
      async execute(_id, params) {
        const notes = await store.listNotes(params);
        return toolTextResult(formatNoteList("Matching notes", notes), {
          status: "ok",
          count: notes.length,
          notes,
        });
      },
    });

    api.registerTool({
      name: "notes_get",
      label: "Get note",
      description: "Fetch one note with its body and appended history",
      parameters: Type.Object({
        noteId: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const note = await store.getNote(params.noteId);
        return toolTextResult(
          [
            formatNote(note),
            note.body ? `\nBody:\n${note.body}` : "",
            note.entries.length
              ? `\nEntries:\n${note.entries.map((entry) => `- ${entry.createdAt}: ${entry.body}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          {
            status: "ok",
            note,
          },
        );
      },
    });

    api.registerTool({
      name: "notes_update",
      label: "Update note",
      description: "Update note fields including title, body, notebook, tags, and pinned state",
      parameters: Type.Object({
        noteId: Type.String({ minLength: 1 }),
        title: Type.Optional(Type.String()),
        body: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        notebook: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        tags: Type.Optional(Type.Array(Type.String())),
        addTags: Type.Optional(Type.Array(Type.String())),
        removeTags: Type.Optional(Type.Array(Type.String())),
        pinned: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const note = await store.updateNote(params);
        return toolTextResult(`Note updated.\n${formatNote(note)}`, {
          status: "updated",
          note,
        });
      },
    });

    api.registerTool({
      name: "notes_append",
      label: "Append note",
      description: "Append a timestamped entry or progress update to an existing note",
      parameters: Type.Object({
        noteId: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
      }),
      async execute(_id, params) {
        const note = await store.appendToNote(params);
        return toolTextResult(`Entry added.\n${formatNote(note)}`, {
          status: "appended",
          note,
        });
      },
    });

    api.registerTool({
      name: "notes_delete",
      label: "Delete note",
      description: "Archive a note by default, or remove it permanently when hardDelete is true",
      parameters: Type.Object({
        noteId: Type.String({ minLength: 1 }),
        hardDelete: Type.Optional(Type.Boolean()),
      }),
      async execute(_id, params) {
        const result = await store.deleteNote(params);
        return toolTextResult(
          `Note ${result.deleted === "removed" ? "deleted permanently" : "archived"}: ${result.noteId}`,
          { status: result.deleted, noteId: result.noteId },
        );
      },
    });
  },
});
