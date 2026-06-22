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
