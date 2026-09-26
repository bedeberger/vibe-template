'use strict';
// Unit: the note-store facade (pure domain logic against a throwaway DB).

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Point the connection at a fresh temp DB BEFORE anything requires it.
const DB = path.join(os.tmpdir(), `vt-unit-${process.pid}.db`);
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });
process.env.DB_PATH = DB;
process.env.LOCAL_DEV_MODE = '0';

const noteStore = require('../../lib/note-store');

test.after(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });
});

test('createNotebook trims and persists', () => {
  const nb = noteStore.createNotebook('  My Notebook  ');
  assert.equal(nb.name, 'My Notebook');
  assert.ok(noteStore.listNotebooks().some((n) => n.id === nb.id));
});

test('createNotebook rejects empty name', () => {
  assert.throws(() => noteStore.createNotebook('   '), /name required/);
});

test('note CRUD lifecycle', () => {
  const nb = noteStore.createNotebook('CRUD');
  const note = noteStore.createNote({ notebookId: nb.id, title: 'Hello', body: 'world' });
  assert.equal(note.title, 'Hello');
  assert.match(note.created_at, /Z$/); // ISO+Z timestamp discipline

  const updated = noteStore.updateNote(note.id, { title: 'Changed' });
  assert.equal(updated.title, 'Changed');
  assert.equal(updated.body, 'world'); // unspecified field preserved

  assert.equal(noteStore.listNotes(nb.id).length, 1);
  assert.equal(noteStore.deleteNote(note.id), true);
  assert.equal(noteStore.getNote(note.id), undefined);
});

test('createNote rejects unknown notebook', () => {
  assert.throws(() => noteStore.createNote({ notebookId: 99999, title: 'x' }), /unknown notebook/);
});

test('listNotebooks derives note_count at read time', () => {
  const nb = noteStore.createNotebook('Counted');
  noteStore.createNote({ notebookId: nb.id, title: 'a' });
  noteStore.createNote({ notebookId: nb.id, title: 'b' });
  assert.equal(noteStore.listNotebooks().find((n) => n.id === nb.id).note_count, 2);
});

test('a new note goes on top; reorderNotes persists the given order', () => {
  const nb = noteStore.createNotebook('Order');
  const a = noteStore.createNote({ notebookId: nb.id, title: 'a' });
  const b = noteStore.createNote({ notebookId: nb.id, title: 'b' });
  const c = noteStore.createNote({ notebookId: nb.id, title: 'c' });
  assert.deepEqual(noteStore.listNotes(nb.id).map((n) => n.title), ['c', 'b', 'a']);

  const listed = noteStore.reorderNotes(nb.id, [a.id, c.id, b.id]);
  assert.deepEqual(listed.map((n) => n.title), ['a', 'c', 'b']);
  assert.deepEqual(noteStore.listNotes(nb.id).map((n) => n.title), ['a', 'c', 'b']);
  // A reorder is not an edit.
  assert.equal(noteStore.getNote(a.id).updated_at, a.updated_at);
});

test('reorderNotes rejects anything but a permutation of the notebook', () => {
  const nb = noteStore.createNotebook('Strict');
  const other = noteStore.createNotebook('Other');
  const a = noteStore.createNote({ notebookId: nb.id, title: 'a' });
  const b = noteStore.createNote({ notebookId: nb.id, title: 'b' });
  const x = noteStore.createNote({ notebookId: other.id, title: 'x' });
  const msg = /every note of the notebook exactly once/;
  assert.throws(() => noteStore.reorderNotes(nb.id, [a.id]), msg);           // incomplete
  assert.throws(() => noteStore.reorderNotes(nb.id, [a.id, a.id]), msg);     // duplicate
  assert.throws(() => noteStore.reorderNotes(nb.id, [a.id, x.id]), msg);     // foreign note
  assert.throws(() => noteStore.reorderNotes(nb.id, 'nope'), /array/);
  assert.throws(() => noteStore.reorderNotes(99999, []), /unknown notebook/);
  assert.deepEqual(noteStore.listNotes(nb.id).map((n) => n.id), [b.id, a.id]); // untouched
});
