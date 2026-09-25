'use strict';
// Integration bootstrap. ORDER MATTERS: env first, then require the app — the DB
// connection opens on the first require of db/, and db/connection.js refuses to
// open anything under NODE_ENV=test without an explicit DB_PATH.
//
//   const { bootstrap } = require('./_helpers/setup');
//   const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });   // before any app require
//   test.before(ctx.start); test.after(ctx.stop);
//   … fetch(ctx.url('/api/notes')) …

const fs = require('fs');
const os = require('os');
const path = require('path');

// Throwaway DB on a RAM filesystem when available: on runners with network
// storage every SQLite write otherwise pays network latency. TEST_TMPDIR overrides.
function tmpBase() {
  if (process.env.TEST_TMPDIR) return process.env.TEST_TMPDIR;
  try {
    fs.accessSync('/dev/shm', fs.constants.W_OK);
    return '/dev/shm';
  } catch {
    return os.tmpdir();
  }
}

function bootstrap(env = {}) {
  const db = path.join(tmpBase(), `vt-int-${process.pid}-${Date.now()}.db`);
  const clean = () => { for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true }); };
  clean();
  Object.assign(process.env, {
    DB_PATH: db,
    LOG_PATH: path.join(tmpBase(), `vt-int-${process.pid}.log`),
    LOG_LEVEL: process.env.LOG_LEVEL || 'error',
    SESSION_SECRET: 'integration-test-secret',
    LOCAL_DEV_MODE: '0',
    ...env,
  });

  let server;
  let base;
  return {
    db,
    async start() {
      const { app } = require('../../../server');
      await new Promise((resolve) => {
        server = app.listen(0, () => {
          base = `http://localhost:${server.address().port}`;
          resolve();
        });
      });
    },
    stop() {
      server?.close();
      clean();
      fs.rmSync(process.env.LOG_PATH, { force: true });
    },
    url: (p) => base + p,
  };
}

module.exports = { bootstrap, tmpBase };
