'use strict';
// Integration: the HTTP API end to end against a real (temp) DB. Runs in
// LOCAL_DEV_MODE so the auth guard auto-authenticates every request. Imports
// the app and binds an ephemeral port (server.js only listens when run direct).

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DB = path.join(os.tmpdir(), `vt-int-${process.pid}.db`);
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });
process.env.DB_PATH = DB;
process.env.LOCAL_DEV_MODE = '1';
process.env.SESSION_SECRET = 'test-secret';

const { app } = require('../../server');

let server;
let base;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://localhost:${server.address().port}`;
      resolve();
    });
  });
});
test.after(() => {
  server.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });
});

const get = (p) => fetch(base + p);
const send = (p, method, body) =>
  fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

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
  let job = await jobRes.json();
  for (let i = 0; i < 50 && job.status !== 'done' && job.status !== 'error'; i++) {
    await new Promise((r) => setTimeout(r, 50));
    job = await (await get(`/api/jobs/${job.id}`)).json();
  }
  assert.equal(job.status, 'done');
  assert.deepEqual(JSON.parse(job.result_json), { noteId: note.id, chars: 13, words: 3 });

  const del = await (await fetch(`${base}/api/notes/${note.id}`, { method: 'DELETE' })).json();
  assert.equal(del.deleted, true);
});

test('unknown API route returns JSON 404', async () => {
  const res = await get('/api/nope');
  assert.equal(res.status, 404);
});
