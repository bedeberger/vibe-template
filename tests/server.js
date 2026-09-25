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
  { id: 1, notebook_id: 1, title: 'Erste', body: 'Hallo <b>Welt</b>', updated_at: '2026-01-01T09:30:00.000Z' },
  { id: 2, notebook_id: 1, title: 'Zweite', body: '', updated_at: '2026-01-01T09:00:00.000Z' },
  { id: 3, notebook_id: 2, title: 'Anderes Buch', body: 'x', updated_at: '2026-01-01T08:00:00.000Z' },
];
function reset() {
  state = { notes: SEED_NOTES(), noteSeq: 100, patches: [], deletes: [], creates: [], jobs: new Map(), jobSeq: 0 };
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
  if (url === '/__mock/reset' && req.method === 'POST') { reset(); return json(res, 200, {}), true; }
  if (url === '/__mock/state' && req.method === 'GET') {
    return json(res, 200, { patches: state.patches, deletes: state.deletes, creates: state.creates, jobs: state.jobs.size }), true;
  }
  if (url === '/api/notebooks' && req.method === 'GET') {
    return json(res, 200, [{ id: 1, name: 'Harness' }, { id: 2, name: 'Zweites' }]), true;
  }
  if (url === '/api/notes' && req.method === 'GET') {
    const nb = Number(new URLSearchParams(req.url.split('?')[1] || '').get('notebook_id'));
    return json(res, 200, state.notes.filter((n) => n.notebook_id === nb)), true;
  }
  if (url === '/api/notes' && req.method === 'POST') {
    const body = await readBody(req);
    const note = { id: ++state.noteSeq, updated_at: '2026-01-02T10:00:00.000Z', ...body };
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
