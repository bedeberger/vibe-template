'use strict';
// Integration: the HTTP API end to end against a real (temp) DB. Runs in
// LOCAL_DEV_MODE so the auth guard auto-authenticates every request. Imports
// the app and binds an ephemeral port (server.js only listens when run direct).

const test = require('node:test');
const assert = require('node:assert');
const { bootstrap } = require('./_helpers/setup');
const { waitForJob } = require('../_helpers/jobs');

const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });
test.before(ctx.start);
test.after(ctx.stop);

const { get, send } = ctx;

test('GET /api/config returns timezone', async () => {
  const res = await get('/api/config');
  assert.equal(res.status, 200);
  const cfg = await res.json();
  assert.ok(cfg.timezone);
});

test('seed notebook is present', async () => {
  const notebooks = await (await get('/api/notebooks')).json();
  assert.ok(notebooks.length >= 1);
});

test('note create → list → job → delete', async () => {
  const notebooks = await (await get('/api/notebooks')).json();
  const nbId = notebooks[0].id;

  const created = await send('/api/notes', 'POST', { notebook_id: nbId, title: 'API note', body: 'one two three' });
  assert.equal(created.status, 201);
  const note = await created.json();

  const list = await (await get(`/api/notes?notebook_id=${nbId}`)).json();
  assert.ok(list.some((n) => n.id === note.id));

  // Background job: enqueue, then poll until done.
  const jobRes = await send('/api/jobs', 'POST', { note_id: note.id, type: 'note-stats' });
  assert.equal(jobRes.status, 202);
  const { id } = await jobRes.json();
  const job = await waitForJob(async () => (await get(`/api/jobs/${id}`)).json());
  assert.equal(job.status, 'done');
  assert.deepEqual(JSON.parse(job.result_json), { noteId: note.id, chars: 13, words: 3 });

  const del = await (await fetch(ctx.url(`/api/notes/${note.id}`), { method: 'DELETE' })).json();
  assert.equal(del.deleted, true);
});

test('notebooks carry note_count; PUT note-order reorders and validates', async () => {
  const nb = await (await send('/api/notebooks', 'POST', { name: 'Order API' })).json();
  const a = await (await send('/api/notes', 'POST', { notebook_id: nb.id, title: 'a' })).json();
  const b = await (await send('/api/notes', 'POST', { notebook_id: nb.id, title: 'b' })).json();

  const listed = (await (await get('/api/notebooks')).json()).find((n) => n.id === nb.id);
  assert.equal(listed.note_count, 2);
  // New notes go on top.
  let notes = await (await get(`/api/notes?notebook_id=${nb.id}`)).json();
  assert.deepEqual(notes.map((n) => n.title), ['b', 'a']);

  const ok = await send(`/api/notebooks/${nb.id}/note-order`, 'PUT', { ids: [a.id, b.id] });
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).map((n) => n.title), ['a', 'b']);
  notes = await (await get(`/api/notes?notebook_id=${nb.id}`)).json();
  assert.deepEqual(notes.map((n) => n.title), ['a', 'b']);

  assert.equal((await send(`/api/notebooks/${nb.id}/note-order`, 'PUT', { ids: [a.id] })).status, 400);
  assert.equal((await send('/api/notebooks/99999/note-order', 'PUT', { ids: [] })).status, 404);
  assert.equal((await send('/api/notebooks/x/note-order', 'PUT', { ids: [] })).status, 400);
});

test('unknown API route returns JSON 404', async () => {
  const res = await get('/api/nope');
  assert.equal(res.status, 404);
});
