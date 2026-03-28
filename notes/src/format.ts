import type { Note } from "./types.js";

export function formatNote(note: Note): string {
  const parts = [`${note.id}: ${note.title}`, `status=${note.status}`];

  if (note.notebook) {
    parts.push(`notebook=${note.notebook}`);
  }
  if (note.pinned) {
    parts.push("pinned=yes");
  }
  if (note.tags.length) {
    parts.push(`tags=${note.tags.join(", ")}`);
  }
  if (note.entries.length) {
    parts.push(`entries=${note.entries.length}`);
  }

  return parts.join(" | ");
}

export function formatNoteList(label: string, notes: Note[]): string {
  if (!notes.length) {
    return `${label}: none`;
  }
  return `${label}:\n${notes.map((note) => `- ${formatNote(note)}`).join("\n")}`;
}
