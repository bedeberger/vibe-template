'use strict';
// Generic in-process background-job queue. Long-running work runs HERE, never
// synchronously inside a request handler (CLAUDE.md → Harte Regeln: Job-Queue).
// This template ships no AI; the same queue is what AI calls would use.
//
// Lifecycle: queued → running → done | error. Status is persisted in the `jobs`
// table so the frontend can poll. Dedup: createJob() returns the existing
// active job instead of enqueuing a duplicate for the same (type, note_id).

const { db } = require('../../db/schema');
const { NOW_ISO_SQL } = require('../../db/now');
const { runWithContext, setContext } = require('../log-context');
const logger = require('../../logger');

const runners = new Map(); // type -> async (job) => resultObject

function registerRunner(type, fn) {
  runners.set(type, fn);
}

// ── Prepared statements ────────────────────────────────────────────────────
const _insert = db.prepare(
  `INSERT INTO jobs (type, note_id, status, status_text, created_at, updated_at)
   VALUES (?, ?, 'queued', ?, ${NOW_ISO_SQL}, ${NOW_ISO_SQL})`
);
const _get = db.prepare('SELECT * FROM jobs WHERE id = ?');
const _byNote = db.prepare('SELECT * FROM jobs WHERE note_id = ? ORDER BY created_at DESC');
const _activeId = db.prepare(
  "SELECT id FROM jobs WHERE type = ? AND note_id = ? AND status IN ('queued','running') ORDER BY id DESC"
);
const _nextQueued = db.prepare("SELECT * FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1");
const _setRunning = db.prepare(
  `UPDATE jobs SET status = 'running', status_text = ?, updated_at = ${NOW_ISO_SQL} WHERE id = ?`
);
const _setDone = db.prepare(
  `UPDATE jobs SET status = 'done', status_text = ?, result_json = ?, finished_at = ${NOW_ISO_SQL}, updated_at = ${NOW_ISO_SQL} WHERE id = ?`
);
const _setError = db.prepare(
  `UPDATE jobs SET status = 'error', status_text = ?, finished_at = ${NOW_ISO_SQL}, updated_at = ${NOW_ISO_SQL} WHERE id = ?`
);

function getJob(id) {
  return _get.get(id);
}
function listJobs(noteId) {
  return _byNote.all(noteId);
}
function findActiveJobId(type, noteId) {
  const row = _activeId.get(type, noteId);
  return row ? row.id : null;
}

// Enqueue a job, or return the existing active one (dedup).
function createJob(type, noteId, statusText = 'queued') {
  if (!runners.has(type)) throw new Error(`no runner registered for job type "${type}"`);
  const existing = findActiveJobId(type, noteId);
  if (existing) return getJob(existing);
  const info = _insert.run(type, noteId, statusText);
  setImmediate(drainQueue);
  return getJob(info.lastInsertRowid);
}

let _draining = false;
async function drainQueue() {
  if (_draining) return;
  _draining = true;
  try {
    let job;
    while ((job = _nextQueued.get())) {
      const runner = runners.get(job.type);
      await runWithContext({ scope: 'job', jobId: job.id, entity: job.note_id }, async () => {
        try {
          _setRunning.run('running', job.id);
          if (!runner) throw new Error(`no runner for type "${job.type}"`);
          const result = await runner(job, { setStatus: (t) => _setRunning.run(t, job.id) });
          _setDone.run('done', JSON.stringify(result ?? null), job.id);
          logger.info(`Job ${job.type} fertig.`);
        } catch (e) {
          _setError.run(String(e.message || e), job.id);
          logger.error(`Job ${job.type} fehlgeschlagen: ${e.message}`);
        }
      });
    }
  } finally {
    _draining = false;
  }
}

module.exports = {
  registerRunner,
  createJob,
  getJob,
  listJobs,
  findActiveJobId,
  drainQueue,
};
