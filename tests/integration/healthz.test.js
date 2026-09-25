'use strict';
// Integration: /healthz answers WITHOUT a session (the deploy workflow and the
// reverse proxy probe it unauthenticated), while the API stays guarded.
// LOCAL_DEV_MODE=0 so the auth guard is really armed.

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DB = path.join(os.tmpdir(), `vt-health-${process.pid}.db`);
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB + suffix, { force: true });
process.env.DB_PATH = DB;
process.env.LOCAL_DEV_MODE = '0';
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

test('GET /healthz is public and reports ok', async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('the API still requires a session', async () => {
  const res = await fetch(`${base}/api/notebooks`);
  assert.equal(res.status, 401);
});
