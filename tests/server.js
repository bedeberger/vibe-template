'use strict';
// Static mini server for the e2e FIXTURE HARNESSES (playwright.config.js).
// Serves public/ at `/` (so absolute paths like /css/…, /js/…, /icons.svg work
// exactly as in the app) and tests/ at `/tests/`, plus deterministic mocks of
// the API endpoints the harnessed modules call. No Express, no DB, no auth —
// a raw http dispatch keeps it dependency-free and fast.
//
// Mock state is inspectable (GET /__mock/state) and resettable
// (POST /__mock/reset, call it in beforeEach).

const http = require('http');
const fs = require('fs');
const path = require('path');

const authUsersMocks = require('./mocks/auth-users');
const settingsMocks = require('./mocks/settings');
const logsMocks = require('./mocks/logs');

const PORT = Number(process.env.PORT) || 3210;
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// ── Mock state ──────────────────────────────────────────────────────────────
// A job answers "running" on its first poll and "done" afterwards, so the
// frontend's poll loop runs through a real state transition.
let state;
// Seed the harness sees on every reset: one note with markup in its body (the
// escape invariant), one empty. Two notebooks so switching can be tested.
const SEED_NOTES = () => [
  { id: 1, notebook_id: 1, position: 0, title: 'Erste', body: 'Hallo <b>Welt</b>', updated_at: '2026-01-01T09:30:00.000Z' },
  { id: 2, notebook_id: 1, position: 1, title: 'Zweite', body: '', updated_at: '2026-01-01T09:00:00.000Z' },
  { id: 3, notebook_id: 2, position: 0, title: 'Anderes Buch', body: 'x', updated_at: '2026-01-01T08:00:00.000Z' },
];
const SEED_NOTEBOOKS = () => [{ id: 1, name: 'Harness' }, { id: 2, name: 'Zweites' }];
// A body long enough to be clamped ("show more").
const LONG_BODY = Array.from({ length: 12 }, (_, i) => `Zeile ${i + 1}`).join('\n');
function reset() {
  state = {
    notes: SEED_NOTES(), notebooks: SEED_NOTEBOOKS(), noteSeq: 100, notebookSeq: 10,
    patches: [], deletes: [], creates: [], orders: [], jobs: new Map(), jobSeq: 0,
  };
}
reset();

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function handleMock(req, res, url) {
  let m;
  if (url === '/__mock/reset' && req.method === 'POST') { reset(); authUsersMocks.reset(); settingsMocks.reset(); logsMocks.reset(); return json(res, 200, {}), true; }
  if (await authUsersMocks.handle(req, res, url, { json, readBody })) return true;
  if (await settingsMocks.handle(req, res, url, { json, readBody })) return true;
  if (await logsMocks.handle(req, res, url, { json, readBody })) return true;
  if (url === '/__mock/state' && req.method === 'GET') {
    return json(res, 200, {
      patches: state.patches, deletes: state.deletes, creates: state.creates, orders: state.orders,
      notebooks: state.notebooks, jobs: state.jobs.size,
    }), true;
  }
  // Test knob: a long note in notebook 1.
  if (url === '/__mock/long-note' && req.method === 'POST') {
    state.notes.push({ id: 50, notebook_id: 1, position: 2, title: 'Lang', body: LONG_BODY, updated_at: '2026-01-01T07:00:00.000Z' });
    return json(res, 200, {}), true;
  }
  if (url === '/api/notebooks' && req.method === 'GET') {
    const count = (id) => state.notes.filter((n) => n.notebook_id === id).length;
    return json(res, 200, state.notebooks.map((nb) => ({ ...nb, note_count: count(nb.id) }))), true;
  }
  if (url === '/api/notebooks' && req.method === 'POST') {
    const body = await readBody(req);
    const nb = { id: ++state.notebookSeq, name: body.name };
    state.notebooks.push(nb);
    return json(res, 201, nb), true;
  }
  // Recorded, not applied: the mock is shared by parallel workers, and a
  // persisted order would leak into another spec's list.
  if ((m = url.match(/^\/api\/notebooks\/(\d+)\/note-order$/)) && req.method === 'PUT') {
    const body = await readBody(req);
    state.orders.push({ notebookId: Number(m[1]), ids: body.ids });
    return json(res, 200, state.notes.filter((n) => n.notebook_id === Number(m[1]))), true;
  }
  if (url === '/api/notes' && req.method === 'GET') {
    const nb = Number(new URLSearchParams(req.url.split('?')[1] || '').get('notebook_id'));
    const list = state.notes.filter((n) => n.notebook_id === nb).sort((a, b) => a.position - b.position);
    return json(res, 200, list), true;
  }
  if (url === '/api/notes' && req.method === 'POST') {
    const body = await readBody(req);
    const top = Math.min(0, ...state.notes.filter((n) => n.notebook_id === body.notebook_id).map((n) => n.position));
    const note = { id: ++state.noteSeq, position: top - 1, updated_at: '2026-01-02T10:00:00.000Z', ...body };
    state.notes.push(note);
    state.creates.push(note);
    return json(res, 201, note), true;
  }
  if ((m = url.match(/^\/api\/notes\/(\d+)$/))) {
    const id = Number(m[1]);
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      state.patches.push({ id, ...body });
      return json(res, 200, { id, notebook_id: 1, updated_at: '2026-01-01T10:00:00.000Z', ...body }), true;
    }
    if (req.method === 'DELETE') { state.deletes.push(id); res.writeHead(204); res.end(); return true; }
  }
  if (url === '/api/jobs' && req.method === 'POST') {
    const body = await readBody(req);
    const id = ++state.jobSeq;
    state.jobs.set(id, { noteId: body.note_id, polls: 0 });
    return json(res, 202, { id, type: body.type, status: 'queued' }), true;
  }
  if ((m = url.match(/^\/api\/jobs\/(\d+)$/)) && req.method === 'GET') {
    const job = state.jobs.get(Number(m[1]));
    if (!job) return json(res, 404, { error: 'not found' }), true;
    const done = job.polls++ >= 1;
    return json(res, 200, done
      ? { id: Number(m[1]), status: 'done', result_json: JSON.stringify({ noteId: job.noteId, chars: 11, words: 2 }) }
      : { id: Number(m[1]), status: 'running' }), true;
  }
  return false;
}

function serveStatic(res, url) {
  const file = url.startsWith('/tests/') ? path.join(ROOT, url) : path.join(PUBLIC, url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  try {
    if (!(await handleMock(req, res, url))) serveStatic(res, url);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('server error: ' + e.message);
  }
});
// Keep-alive longer than Playwright's socket reuse — avoids ECONNRESET under
// parallel workers loading dozens of ESM modules each.
server.keepAliveTimeout = 70_000;
server.headersTimeout = 75_000;
server.listen(PORT, () => console.log(`test server on :${PORT}`));
