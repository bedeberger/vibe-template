'use strict';
// Jobs API — enqueue background work and poll its status. The frontend POSTs to
// start a job, then polls GET /api/jobs/:id until status is done|error.
// Requiring a job module registers its runner with the queue; a new job type is
// one file next to this one plus one entry in KNOWN_TYPES (enqueueable via the
// API). A scheduled job type is only required here — the scheduler enqueues it.

const express = require('express');
const queue = require('./shared/queue');
const { TYPE: NOTE_STATS } = require('./note-stats');
require('./jobs-cleanup'); // scheduled (cron), not enqueueable via the API
const { setContext } = require('../../lib/log-context');
const { invalid, notFound } = require('../../lib/errors');
const { handle, requireId } = require('../_http');

const router = express.Router();

const KNOWN_TYPES = new Set([NOTE_STATS]);

// Enqueue (or return the existing active job — dedup is in the queue).
router.post('/jobs', handle((req) => {
  const noteId = requireId(req.body?.note_id, 'note_id required');
  const type = req.body?.type || NOTE_STATS;
  if (!KNOWN_TYPES.has(type)) throw invalid(`unknown job type: ${type}`);
  setContext({ entity: noteId });
  return queue.createJob(type, noteId);
}, { status: 202 }));

router.get('/jobs/:id', handle((req) => {
  const id = requireId(req.params.id);
  setContext({ jobId: id });
  const job = queue.getJob(id);
  if (!job) throw notFound();
  return job;
}));

router.get('/jobs', handle((req) => {
  const noteId = requireId(req.query.note_id, 'note_id required');
  return queue.listJobs(noteId);
}));

module.exports = router;
