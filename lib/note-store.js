'use strict';
// ★ FACADE — the single entry point for the notes domain.
//
// Routes, jobs and any other consumer import THIS module, never db/notes.js
// and never raw SQL against `notes`/`notebooks`. Cross-cutting concerns
// (validation, invariants, future caching/eventing) live here, in one place.
// A refusal is thrown as a DomainError (lib/errors.js) — the route maps its
// kind to a status code, the facade knows nothing about HTTP.
//
// See CLAUDE.md → Harte Regeln: "Domänen-Facade als einziger Eintrittspunkt".

const notesDb = require('../db/notes');
const { invalid, notFound } = require('./errors');

// ── Validation helpers (one rule per field, shared by create + update) ──────
function requiredText(value, message) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) throw invalid(message);
  return trimmed;
}

function requireNotebook(id) {
  const notebook = notesDb.getNotebook(id);
  if (!notebook) throw notFound('unknown notebook');
  return notebook;
}

// ── Notebooks ────────────────────────────────────────────────────────────
function listNotebooks() {
  return notesDb.listNotebooks();
}

function createNotebook(name) {
  return notesDb.createNotebook(requiredText(name, 'notebook name required'));
}

// ── Notes ────────────────────────────────────────────────────────────────
function listNotes(notebookId) {
  return notesDb.listNotes(notebookId);
}

// Returns the note or null — a reader decides whether "missing" is an error.
function getNote(id) {
  return notesDb.getNote(id) || null;
}

function createNote({ notebookId, title, body }) {
  requireNotebook(notebookId);
  return notesDb.createNote({
    notebook_id: notebookId,
    title: requiredText(title, 'note title required'),
    body: String(body ?? ''),
  });
}

// Partial update: a field left out (undefined/null) keeps its value; a title
// that IS given must not be empty — the same rule as on create.
function updateNote(id, { title, body } = {}) {
  const existing = notesDb.getNote(id);
  if (!existing) throw notFound();
  return notesDb.updateNote(id, {
    title: title != null ? requiredText(title, 'note title required') : existing.title,
    body: body != null ? String(body) : existing.body,
  });
}

// Idempotent: deleting a missing note is not an error, the answer says so.
function deleteNote(id) {
  return notesDb.deleteNote(id);
}

// ids must be exactly the notebook's notes (a permutation) — a partial or
// stale list would leave two notes on the same position.
function reorderNotes(notebookId, ids) {
  requireNotebook(notebookId);
  if (!Array.isArray(ids)) throw invalid('ids must be an array');
  const wanted = ids.map(Number);
  const current = notesDb.listNotes(notebookId).map((n) => n.id).sort((a, b) => a - b);
  const given = [...wanted].sort((a, b) => a - b);
  if (given.length !== current.length || given.some((id, i) => id !== current[i])) {
    throw invalid('ids must list every note of the notebook exactly once');
  }
  notesDb.reorderNotes(notebookId, wanted);
  return notesDb.listNotes(notebookId);
}

module.exports = {
  listNotebooks,
  createNotebook,
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  reorderNotes,
};
