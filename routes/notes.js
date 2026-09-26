'use strict';
// Notes API. Handlers go through the note-store facade exclusively — no SQL
// here. Each handler that touches a specific note tags the log context with
// its id so the request is traceable end to end.

const express = require('express');
const noteStore = require('../lib/note-store');
const { setContext } = require('../lib/log-context');

const router = express.Router();

function toIntId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ── Notebooks ──────────────────────────────────────────────────────────────
router.get('/notebooks', (req, res) => {
  res.json(noteStore.listNotebooks());
});

router.post('/notebooks', (req, res) => {
  try {
    res.status(201).json(noteStore.createNotebook(req.body?.name));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Manual order (drag & drop): body { ids } = every note of the notebook in
// its new order. Answers with the reordered list.
router.put('/notebooks/:id/note-order', (req, res) => {
  const id = toIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  setContext({ entity: id });
  try {
    res.json(noteStore.reorderNotes(id, req.body?.ids));
  } catch (e) {
    res.status(e.message === 'unknown notebook' ? 404 : 400).json({ error: e.message });
  }
});

// ── Notes ────────────────────────────────────────────────────────────────
router.get('/notes', (req, res) => {
  const notebookId = toIntId(req.query.notebook_id);
  if (!notebookId) return res.status(400).json({ error: 'notebook_id required' });
  res.json(noteStore.listNotes(notebookId));
});

router.post('/notes', (req, res) => {
  const notebookId = toIntId(req.body?.notebook_id);
  if (!notebookId) return res.status(400).json({ error: 'notebook_id required' });
  try {
    const note = noteStore.createNote({
      notebookId,
      title: req.body?.title,
      body: req.body?.body,
    });
    setContext({ entity: note.id });
    res.status(201).json(note);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/notes/:id', (req, res) => {
  const id = toIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  setContext({ entity: id });
  const note = noteStore.getNote(id);
  if (!note) return res.status(404).json({ error: 'not found' });
  res.json(note);
});

router.patch('/notes/:id', (req, res) => {
  const id = toIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  setContext({ entity: id });
  const updated = noteStore.updateNote(id, { title: req.body?.title, body: req.body?.body });
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});

router.delete('/notes/:id', (req, res) => {
  const id = toIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  setContext({ entity: id });
  res.json({ deleted: noteStore.deleteNote(id) });
});

module.exports = router;
