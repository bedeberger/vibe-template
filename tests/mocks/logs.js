'use strict';
// Mocks for the admin log viewer (routes/admin-logs.js). The stream sends one
// entry right away and then stays open, so the harness sees a live line
// without timing games. Requests are recorded: GET /__mock/logs.

let state;
const SEED = () => [
  { ts: '2026-01-02T09:00:02.000Z', level: 'error', scope: 'job', user: null, entity: '7', jobId: 'abc', msg: 'Job fehlgeschlagen <b>x</b>', stack: ['Error: kaputt', '    at run (job.js:1:1)'] },
  { ts: '2026-01-02T09:00:01.000Z', level: 'warn', scope: 'admin', user: 'admin@local', entity: 'anna@local', jobId: null, msg: 'Benutzer-Status: disabled.', stack: null },
  { ts: '2026-01-02T09:00:00.000Z', level: 'info', scope: 'http', user: 'anna@local', entity: 'GET /api/notes', jobId: null, msg: 'Liste geladen', stack: null },
];
const OLDER = { ts: '2026-01-01T08:00:00.000Z', level: 'info', scope: 'http', user: null, entity: null, jobId: null, msg: 'Älterer Eintrag', stack: null };
const LIVE = { ts: '2026-01-02T10:00:00.000Z', level: 'info', scope: 'http', user: 'ben@local', entity: null, jobId: null, msg: 'Live-Zeile', stack: null };

function reset() {
  state = { calls: [], streams: 0 };
}
reset();

async function handle(req, res, url, { json }) {
  if (url === '/__mock/logs' && req.method === 'GET') return json(res, 200, state), true;
  if (req.method !== 'GET' || !url.startsWith('/api/admin/logs')) return false;
  const q = new URLSearchParams(req.url.split('?')[1] || '');

  if (url === '/api/admin/logs') {
    state.calls.push(Object.fromEntries(q));
    if (q.get('before')) return json(res, 200, { entries: [OLDER], hasMore: false }), true;
    const level = q.get('level');
    const entries = SEED().filter((e) => !level || e.level === level);
    return json(res, 200, { entries, hasMore: !level }), true;
  }
  if (url === '/api/admin/logs/files') {
    return json(res, 200, { files: [
      { key: 'current', name: 'app.log', size: 20480, mtime: '2026-01-02T09:00:02.000Z' },
      { key: '1', name: 'app1.log', size: 5242880, mtime: '2026-01-01T09:00:00.000Z' },
    ] }), true;
  }
  if (url === '/api/admin/logs/stream') {
    state.streams++;
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    res.write(`data: ${JSON.stringify(LIVE)}\n\n`);
    return true; // left open until the client closes it
  }
  return false;
}

module.exports = { handle, reset };
