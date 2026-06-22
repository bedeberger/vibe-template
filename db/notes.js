'use strict';
// Low-level SQL for the notes domain (notebooks + notes). This module is NOT
// imported directly by routes or jobs — it is reached only through the
// lib/note-store.js facade (see CLAUDE.md → Harte Regeln: Domänen-Facade).
//
// Timestamps are written explicitly with NOW_ISO_SQL rather than relying on
// column defaults, so the value is identical on every write path.

const { db } = require('./schema');
const { NOW_ISO_SQL } = require('./now');

// ── Notebooks ────────────────────────────────────────────────────────────
const _insertNotebook = db.prepare(
  `INSERT INTO notebooks (name, created_at) VALUES (?, ${NOW_ISO_SQL})`
);
const _allNotebooks = db.prepare('SELECT * FROM notebooks ORDER BY created_at');
const _getNotebook = db.prepare('SELECT * FROM notebooks WHERE id = ?');

function createNotebook(name) {
  const info = _insertNotebook.run(name);
  return _getNotebook.get(info.lastInsertRowid);
}
function listNotebooks() {
  return _allNotebooks.all();
}
function getNotebook(id) {
  return _getNotebook.get(id);
}

// ── Notes ────────────────────────────────────────────────────────────────
const _insertNote = db.prepare(
  `INSERT INTO notes (notebook_id, title, body, created_at, updated_at)
   VALUES (@notebook_id, @title, @body, ${NOW_ISO_SQL}, ${NOW_ISO_SQL})`
);
const _getNote = db.prepare('SELECT * FROM notes WHERE id = ?');
const _notesByNotebook = db.prepare(
  'SELECT * FROM notes WHERE notebook_id = ? ORDER BY updated_at DESC'
);
const _updateNote = db.prepare(
  `UPDATE notes SET title = @title, body = @body, updated_at = ${NOW_ISO_SQL} WHERE id = @id`
);
const _deleteNote = db.prepare('DELETE FROM notes WHERE id = ?');

function createNote({ notebook_id, title, body = '' }) {
  const info = _insertNote.run({ notebook_id, title, body });
  return _getNote.get(info.lastInsertRowid);
}
function getNote(id) {
  return _getNote.get(id);
}
function listNotes(notebookId) {
  return _notesByNotebook.all(notebookId);
}
function updateNote(id, { title, body }) {
  _updateNote.run({ id, title, body });
  return _getNote.get(id);
}
function deleteNote(id) {
  return _deleteNote.run(id).changes > 0;
}

module.exports = {
  createNotebook,
  listNotebooks,
  getNotebook,
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
};
