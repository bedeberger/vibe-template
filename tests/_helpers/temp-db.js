'use strict';
// Throwaway SQLite DBs for tests — ONE pattern for every test file that needs
// a database. ORDER MATTERS: the connection opens on the first require of db/
// (or of a facade in lib/), and under NODE_ENV=test db/connection.js refuses to
// open anything without an explicit DB_PATH. So: helper first, app code after.
//
//   const { useTempDb } = require('../_helpers/temp-db');
//   useTempDb('users', { ADMIN_EMAIL: 'chef@example.com' }); // DB_PATH + env, cleanup after the run
//   const users = require('../../lib/user-store');           // only now
//
// Integration tests get the same via bootstrap() (tests/integration/_helpers/setup.js).

const fs = require('fs');
const os = require('os');
const path = require('path');

// A RAM filesystem when available: on runners with network storage every
// SQLite write otherwise pays network latency. TEST_TMPDIR overrides.
function tmpBase() {
  if (process.env.TEST_TMPDIR) return process.env.TEST_TMPDIR;
  try {
    fs.accessSync('/dev/shm', fs.constants.W_OK);
    return '/dev/shm';
  } catch {
    return os.tmpdir();
  }
}

let counter = 0;
// A unique path per call — test files run in parallel processes.
function tempDbPath(name = 'db') {
  counter += 1;
  return path.join(tmpBase(), `vt-${name}-${process.pid}-${Date.now()}-${counter}.db`);
}

// SQLite in WAL mode leaves -wal/-shm next to the file.
function removeDb(file) {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
}

// Points the app at a fresh DB for this test file and removes it after the run.
// `env` is applied too (LOCAL_DEV_MODE defaults to '0' — no dev seed, no bypass).
function useTempDb(name, env = {}) {
  const file = tempDbPath(name);
  removeDb(file);
  Object.assign(process.env, { DB_PATH: file, LOCAL_DEV_MODE: '0', ...env });
  require('node:test').after(() => removeDb(file));
  return file;
}

module.exports = { tmpBase, tempDbPath, removeDb, useTempDb };
