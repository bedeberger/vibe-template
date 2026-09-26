'use strict';
// Notes API. Handlers go through the note-store facade exclusively — no SQL
// here. Each handler that touches a specific note tags the log context with
// its id so the request is traceable end to end. The pattern every router
// follows (routes/_http.js): validate the id, set the context, call the
// facade, return the result — handle() sends it and maps DomainErrors.

const express = require('express');
const noteStore = require('../lib/note-store');
const { setContext } = require('../lib/log-context');
const { notFound } = require('../lib/errors');
const { handle, requireId } = require('./_http');

const router = express.Router();

// ── Notebooks ──────────────────────────────────────────────────────────────
router.get('/notebooks', handle(() => noteStore.listNotebooks()));

router.post('/notebooks', handle((req) => noteStore.createNotebook(req.body?.name), { status: 201 }));

// Manual order (drag & drop): body { ids } = every note of the notebook in
// its new order. Answers with the reordered list.
router.put('/notebooks/:id/note-order', handle((req) => {
  const id = requireId(req.params.id);
  setContext({ entity: id });
  return noteStore.reorderNotes(id, req.body?.ids);
}));

// ── Notes ────────────────────────────────────────────────────────────────
router.get('/notes', handle((req) => {
  const notebookId = requireId(req.query.notebook_id, 'notebook_id required');
  return noteStore.listNotes(notebookId);
}));

router.post('/notes', handle((req) => {
  const notebookId = requireId(req.body?.notebook_id, 'notebook_id required');
  const note = noteStore.createNote({ notebookId, title: req.body?.title, body: req.body?.body });
  setContext({ entity: note.id });
  return note;
}, { status: 201 }));

router.get('/notes/:id', handle((req) => {
  const id = requireId(req.params.id);
  setContext({ entity: id });
  const note = noteStore.getNote(id);
  if (!note) throw notFound();
  return note;
}));

router.patch('/notes/:id', handle((req) => {
  const id = requireId(req.params.id);
  setContext({ entity: id });
  return noteStore.updateNote(id, { title: req.body?.title, body: req.body?.body });
}));

router.delete('/notes/:id', handle((req) => {
  const id = requireId(req.params.id);
  setContext({ entity: id });
  return { deleted: noteStore.deleteNote(id) };
}));

module.exports = router;
