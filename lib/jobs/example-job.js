'use strict';
// Example job type: "note-stats". Stands in for any long-running task (an AI
// call, an export, a batch import). It reads a note through the facade and
// computes trivial stats. Replace with real work; keep the shape:
//
//   1. register a runner under a stable type string,
//   2. the runner reads via a facade, returns a plain result object,
//   3. routes enqueue via queue.createJob(type, noteId) with dedup.

const noteStore = require('../note-store');
const { registerRunner } = require('./queue');

const TYPE = 'note-stats';

registerRunner(TYPE, async (job) => {
  const note = noteStore.getNote(job.note_id);
  if (!note) throw new Error('note not found');
  const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
  return { noteId: note.id, chars: note.body.length, words };
});

module.exports = { TYPE };
