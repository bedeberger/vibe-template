'use strict';
// Integration: the admin log viewer API (routes/admin-logs.js) against the real
// log file of the test process (LOG_PATH from the bootstrap). LOCAL_DEV_MODE:
// the dev user is admin. Lines are appended to the file directly, so the test
// does not depend on LOG_LEVEL.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { bootstrap } = require('./_helpers/setup');

const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });
test.before(ctx.start);
test.after(ctx.stop);

const append = (...lines) => fs.appendFileSync(process.env.LOG_PATH, lines.map((l) => l + '\n').join(''));
const { get } = ctx;

test('GET /api/admin/logs: newest first, filter, cursor', async () => {
  append(
    '2026-05-01T10:00:00.000Z INFO [http|dev@local|GET /api/notes|-] eins',
    '2026-05-01T10:00:01.000Z ERROR [job|-|3|abc] zwei',
    'Error: stack line',
  );
  const all = await (await get('/api/admin/logs?limit=1000')).json();
  const mine = all.entries.filter((e) => e.ts.startsWith('2026-05-01'));
  assert.deepEqual(mine.map((e) => e.msg), ['zwei', 'eins']);
  assert.deepEqual(mine[0].stack, ['Error: stack line']);

  const errors = await (await get('/api/admin/logs?level=error&q=zwei')).json();
  assert.deepEqual(errors.entries.map((e) => e.msg), ['zwei']);
  assert.equal(errors.entries[0].jobId, 'abc');

  const older = await (await get(`/api/admin/logs?q=eins&before=${encodeURIComponent('2026-05-01T10:00:00.000Z')}`)).json();
  assert.equal(older.entries.length, 0);
});

test('GET /api/admin/logs/files + download', async () => {
  const { files } = await (await get('/api/admin/logs/files')).json();
  assert.equal(files[0].key, 'current');

  const res = await get('/api/admin/logs/download?file=current');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /attachment; filename=".+\.log"/);
  assert.match(await res.text(), /zwei/);

  assert.equal((await get('/api/admin/logs/download?file=9')).status, 404);
});

test('GET /api/admin/logs/stream pushes appended entries as SSE', async () => {
  const ac = new AbortController();
  const res = await fetch(ctx.url('/api/admin/logs/stream'), { signal: ac.signal });
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  setTimeout(() => append('2026-05-02T00:00:00.000Z WARN live-zeile'), 100);
  let buf = '';
  const deadline = Date.now() + 5000;
  while (!buf.includes('live-zeile') && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value);
  }
  ac.abort();
  const data = buf.split('\n').find((l) => l.startsWith('data: ') && l.includes('live-zeile'));
  assert.ok(data, `no SSE data line in: ${buf}`);
  assert.equal(JSON.parse(data.slice(6)).level, 'warn');
});
