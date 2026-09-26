'use strict';
// Admin console — log viewer (docs/logging.md). Mounted under /api/admin/logs
// behind requireAdmin (server.js). Thin: parse the query, call
// lib/log-reader.js, map to HTTP. No privacy boundary — the admin sees every
// line the server writes; a download is logged as an audit line.
//
//   GET /api/admin/logs?level&scope&user&entity&q&before&limit  newest first, { entries, hasMore }
//   GET /api/admin/logs/files                                   current + rotated files
//   GET /api/admin/logs/download?file=current|1|…               one file as text/plain
//   GET /api/admin/logs/stream                                  SSE live tail (new entries)

const express = require('express');
const fs = require('fs');
const path = require('path');
const logs = require('../lib/log-reader');
const { setContext } = require('../lib/log-context');
const { handle } = require('./_http');
const { notFound } = require('../lib/errors');
const logger = require('../logger');

const router = express.Router();

router.use((req, res, next) => {
  setContext({ scope: 'admin' });
  next();
});

router.get('/', handle((req) => {
  const { before, limit, ...filter } = req.query;
  return logs.search({ filter, before: typeof before === 'string' && before ? before : null, limit });
}));

router.get('/files', handle(() => ({ files: logs.fileInfos() })));

router.get('/download', handle((req, res) => {
  const file = logs.resolveFile(req.query.file || 'current');
  if (!file) throw notFound();
  const name = path.basename(file);
  setContext({ entity: name });
  logger.info(`Log-Datei heruntergeladen: ${name}`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  fs.createReadStream(file).pipe(res);
}));

// Server-Sent Events. `no-transform` keeps compression() from buffering the
// stream; X-Accel-Buffering does the same for the reverse proxy. A comment
// line every 15 s keeps idle proxies from closing the connection.
router.get('/stream', handle((req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    if (res.writableEnded) return;
    res.write(`${event ? `event: ${event}\n` : ''}data: ${JSON.stringify(data)}\n\n`);
  };
  const stop = logs.follow({
    onEntry: (e) => send(null, e),
    onRotated: () => send('rotated', {}),
  });
  const heartbeat = setInterval(() => { if (!res.writableEnded) res.write(':hb\n\n'); }, 15000);
  heartbeat.unref?.();

  req.on('close', () => {
    stop();
    clearInterval(heartbeat);
    res.end();
  });
}));

module.exports = router;
