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
// note_count is derived at read time (no snapshot column).
const _allNotebooks = db.prepare(
  `SELECT nb.*, (SELECT COUNT(*) FROM notes n WHERE n.notebook_id = nb.id) AS note_count
   FROM notebooks nb ORDER BY nb.created_at`
);
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
// Order: `position` ascending (manual, drag & drop). A new note goes on top —
// one below the current minimum, so no other row has to move.
const _insertNote = db.prepare(
  `INSERT INTO notes (notebook_id, title, body, position, created_at, updated_at)
   VALUES (@notebook_id, @title, @body,
           (SELECT COALESCE(MIN(position), 0) - 1 FROM notes WHERE notebook_id = @notebook_id),
           ${NOW_ISO_SQL}, ${NOW_ISO_SQL})`
);
const _getNote = db.prepare('SELECT * FROM notes WHERE id = ?');
const _notesByNotebook = db.prepare(
  'SELECT * FROM notes WHERE notebook_id = ? ORDER BY position, id'
);
const _updateNote = db.prepare(
  `UPDATE notes SET title = @title, body = @body, updated_at = ${NOW_ISO_SQL} WHERE id = @id`
);
const _deleteNote = db.prepare('DELETE FROM notes WHERE id = ?');
// Position only — a reorder is not an edit, updated_at stays.
const _setPosition = db.prepare('UPDATE notes SET position = ? WHERE id = ? AND notebook_id = ?');

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
// ids = the notebook's notes in their new order; all or nothing.
const reorderNotes = db.transaction((notebookId, ids) => {
  ids.forEach((id, i) => _setPosition.run(i, id, notebookId));
});

module.exports = {
  createNotebook,
  listNotebooks,
  getNotebook,
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
  reorderNotes,
};
