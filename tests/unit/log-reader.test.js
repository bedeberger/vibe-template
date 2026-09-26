'use strict';
// Unit: lib/log-reader.js — parser, backwards reader, rotation chain, search
// filters + cursor, live follow. Works on temp files passed as `base`, so the
// real logger file is never touched.

const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-logs-'));
process.env.LOG_PATH = path.join(DIR, 'logger.log');
process.env.LOG_LEVEL = 'error';

const logs = require('../../lib/log-reader');

const BASE = path.join(DIR, 'app.log');
const line = (ts, level, tag, msg) => `${ts} ${level} ${tag ? `[${tag}] ` : ''}${msg}`;
const write = (file, lines) => fs.writeFileSync(file, lines.join('\n') + '\n');

test.after(() => fs.rmSync(DIR, { recursive: true, force: true }));

test('parseHeader: tag slots, "-" → null, line without tag', () => {
  const e = logs.parseHeader('2026-01-01T09:30:00.123Z INFO [http|a@b.ch|GET /api/notes|-] hallo');
  assert.deepEqual(e, { ts: '2026-01-01T09:30:00.123Z', level: 'info', scope: 'http', user: 'a@b.ch', entity: 'GET /api/notes', jobId: null, msg: 'hallo', stack: null });
  const bare = logs.parseHeader('2026-01-01T09:30:00.123Z WARN ohne Kontext');
  assert.equal(bare.scope, null);
  assert.equal(bare.msg, 'ohne Kontext');
  assert.equal(logs.parseHeader('    at foo (bar.js:1:1)'), null);
});

test('parseLines: continuation lines become the stack of the previous entry', () => {
  const out = [...logs.parseLines([
    'garbage before any header',
    line('2026-01-01T09:00:00.000Z', 'ERROR', 'job|-|7|abc', 'kaputt'),
    'Error: kaputt',
    '    at x (y.js:1:1)',
    line('2026-01-01T09:00:01.000Z', 'INFO', null, 'weiter'),
  ])];
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].stack, ['Error: kaputt', '    at x (y.js:1:1)']);
  assert.equal(out[1].stack, null);
});

test('readLinesReverse: newest first, multi-byte chars across the 64 KB chunk boundary', async () => {
  const f = path.join(DIR, 'big.log');
  const lines = Array.from({ length: 3000 }, (_, i) => `${i} Grüsse äöü ✓ ${'x'.repeat(i % 50)}`);
  write(f, lines);
  const got = [];
  for await (const l of logs.readLinesReverse(f)) got.push(l);
  assert.deepEqual(got, [...lines].reverse());
});

test('listFiles/resolveFile/fileInfos: current first, then rotated app1…', () => {
  write(BASE, [line('2026-01-03T00:00:00.000Z', 'INFO', null, 'neu')]);
  write(path.join(DIR, 'app1.log'), [line('2026-01-02T00:00:00.000Z', 'INFO', null, 'mittel')]);
  write(path.join(DIR, 'app2.log'), [line('2026-01-01T00:00:00.000Z', 'INFO', null, 'alt')]);
  assert.deepEqual(logs.listFiles(BASE).map((f) => path.basename(f)), ['app.log', 'app1.log', 'app2.log']);
  assert.equal(path.basename(logs.resolveFile('current', BASE)), 'app.log');
  assert.equal(path.basename(logs.resolveFile('2', BASE)), 'app2.log');
  assert.equal(logs.resolveFile('3', BASE), null);
  assert.equal(logs.resolveFile('../etc/passwd', BASE), null);
  assert.deepEqual(logs.fileInfos(BASE).map((f) => f.key), ['current', '1', '2']);
});

test('search: newest first across the rotation chain, cursor + hasMore', async () => {
  const all = await logs.search({ base: BASE });
  assert.deepEqual(all.entries.map((e) => e.msg), ['neu', 'mittel', 'alt']);
  assert.equal(all.hasMore, false);

  const page1 = await logs.search({ base: BASE, limit: 2 });
  assert.deepEqual(page1.entries.map((e) => e.msg), ['neu', 'mittel']);
  assert.equal(page1.hasMore, true);
  const page2 = await logs.search({ base: BASE, limit: 2, before: page1.entries[1].ts });
  assert.deepEqual(page2.entries.map((e) => e.msg), ['alt']);
  assert.equal(page2.hasMore, false);
});

test('search: filters on level, scope, user (case-insensitive), entity, text incl. stack', async () => {
  const f = path.join(DIR, 'filter.log');
  write(f, [
    line('2026-02-01T00:00:00.000Z', 'INFO', 'http|Anna@x.ch|GET /api/notes|-', 'liste'),
    line('2026-02-01T00:00:01.000Z', 'ERROR', 'job|-|42|j1', 'fehlgeschlagen'),
    'Error: Datenbank weg',
    line('2026-02-01T00:00:02.000Z', 'WARN', 'admin|bob@x.ch|-|-', 'Status geändert'),
  ]);
  const msgs = async (filter) => (await logs.search({ base: f, filter })).entries.map((e) => e.msg);
  assert.deepEqual(await msgs({ level: 'error' }), ['fehlgeschlagen']);
  assert.deepEqual(await msgs({ scope: 'admin' }), ['Status geändert']);
  assert.deepEqual(await msgs({ user: 'anna@X.CH' }), ['liste']);
  assert.deepEqual(await msgs({ entity: '/api/notes' }), ['liste']);
  assert.deepEqual(await msgs({ q: 'datenbank' }), ['fehlgeschlagen']);
  assert.deepEqual(await msgs({ level: 'bogus' }), ['Status geändert', 'fehlgeschlagen', 'liste']);
  const [err] = (await logs.search({ base: f, filter: { level: 'error' } })).entries;
  assert.deepEqual(err.stack, ['Error: Datenbank weg']);
});

test('follow: delivers appended entries and reports a rotation', async () => {
  const f = path.join(DIR, 'live.log');
  write(f, [line('2026-03-01T00:00:00.000Z', 'INFO', null, 'vorher')]);
  const seen = [];
  let rotated = 0;
  const stop = logs.follow({ base: f, pollMs: 50, onEntry: (e) => seen.push(e.msg), onRotated: () => { rotated++; } });
  const until = async (cond) => { for (let i = 0; i < 100 && !cond(); i++) await new Promise((r) => setTimeout(r, 20)); };
  try {
    fs.appendFileSync(f, line('2026-03-01T00:00:01.000Z', 'INFO', null, 'neu') + '\n');
    await until(() => seen.includes('neu'));
    assert.deepEqual(seen, ['neu']); // the line present at start is not replayed
    write(f, [line('2026-03-01T00:00:02.000Z', 'INFO', null, 'x')]); // shrinks → rotation
    await until(() => rotated > 0 && seen.includes('x'));
    assert.equal(rotated, 1);
    assert.deepEqual(seen, ['neu', 'x']);
  } finally {
    stop();
  }
});
