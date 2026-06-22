'use strict';
// Jobs API — enqueue background work and poll its status. The frontend POSTs to
// start a job, then polls GET /api/jobs/:id until status is done|error.

const express = require('express');
const queue = require('../lib/jobs/queue');
const { TYPE: NOTE_STATS } = require('../lib/jobs/example-job');
const { setContext } = require('../lib/log-context');

const router = express.Router();

const KNOWN_TYPES = new Set([NOTE_STATS]);

function toIntId(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Enqueue (or return the existing active job — dedup is in the queue).
router.post('/jobs', (req, res) => {
  const noteId = toIntId(req.body?.note_id);
  const type = req.body?.type || NOTE_STATS;
  if (!noteId) return res.status(400).json({ error: 'note_id required' });
  if (!KNOWN_TYPES.has(type)) return res.status(400).json({ error: `unknown job type: ${type}` });
  setContext({ entity: noteId });
  res.status(202).json(queue.createJob(type, noteId));
});

router.get('/jobs/:id', (req, res) => {
  const id = toIntId(req.params.id);
  if (!id) return res.status(400).json({ error: 'invalid id' });
  const job = queue.getJob(id);
  if (!job) return res.status(404).json({ error: 'not found' });
  res.json(job);
});

router.get('/jobs', (req, res) => {
  const noteId = toIntId(req.query.note_id);
  if (!noteId) return res.status(400).json({ error: 'note_id required' });
  res.json(queue.listJobs(noteId));
});

module.exports = router;
