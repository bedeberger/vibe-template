'use strict';
// Integration bootstrap. ORDER MATTERS: env first, then require the app — the DB
// connection opens on the first require of db/, and db/connection.js refuses to
// open anything under NODE_ENV=test without an explicit DB_PATH.
//
//   const { bootstrap } = require('./_helpers/setup');
//   const ctx = bootstrap({ LOCAL_DEV_MODE: '1' });   // before any app require
//   test.before(ctx.start); test.after(ctx.stop);
//
//   const res = await ctx.get('/api/notes?notebook_id=1');           // fetch Response
//   const res = await ctx.send('/api/notes', 'POST', { title: 'x' }); // JSON body
//   const eva = ctx.client();                                          // own cookie jar = one "browser"
//   const { status, json } = await eva.call('/auth/login', { method: 'POST', body: { … } });
//
// LOCAL_DEV_MODE=1 authenticates every request (no login needed); with '0' use
// ctx.client() and log in like a browser.

const fs = require('fs');
const path = require('path');
const { tmpBase, tempDbPath, removeDb } = require('../../_helpers/temp-db');

function bootstrap(env = {}) {
  const db = tempDbPath('int');
  removeDb(db);
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
  const url = (p) => base + p;

  // A client with its own session cookie. Answers { status, json, headers };
  // json is null for a non-JSON body (an HTML page, a redirect).
  function client() {
    let cookie = '';
    const call = async (p, { method = 'GET', body } = {}) => {
      const res = await fetch(url(p), {
        method,
        redirect: 'manual',
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* not JSON */ }
      return { status: res.status, json, headers: res.headers };
    };
    return { call };
  }

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
      removeDb(db);
      fs.rmSync(process.env.LOG_PATH, { force: true });
    },
    url,
    get: (p) => fetch(url(p)),
    send: (p, method, body) =>
      fetch(url(p), { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    client,
  };
}

module.exports = { bootstrap, tmpBase };
