'use strict';
// ★ FACADE — the single entry point for the notes domain.
//
// Routes, jobs and any other consumer import THIS module, never db/notes.js
// and never raw SQL against `notes`/`notebooks`. Cross-cutting concerns
// (validation, invariants, future caching/eventing) live here, in one place.
//
// See CLAUDE.md → Harte Regeln: "Domänen-Facade als einziger Eintrittspunkt".

const notesDb = require('../db/notes');

function listNotebooks() {
  return notesDb.listNotebooks();
}

function createNotebook(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('notebook name required');
  return notesDb.createNotebook(trimmed);
}

function listNotes(notebookId) {
  return notesDb.listNotes(notebookId);
}

function getNote(id) {
  return notesDb.getNote(id);
}

function createNote({ notebookId, title, body = '' }) {
  if (!notesDb.getNotebook(notebookId)) throw new Error('unknown notebook');
  const trimmed = String(title || '').trim();
  if (!trimmed) throw new Error('note title required');
  return notesDb.createNote({ notebook_id: notebookId, title: trimmed, body: String(body) });
}

function updateNote(id, { title, body }) {
  const existing = notesDb.getNote(id);
  if (!existing) return null;
  return notesDb.updateNote(id, {
    title: title != null ? String(title).trim() : existing.title,
    body: body != null ? String(body) : existing.body,
  });
}

function deleteNote(id) {
  return notesDb.deleteNote(id);
}

module.exports = {
  listNotebooks,
  createNotebook,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
};
