'use strict';
// Admin console — user management (docs/auth.md). Mounted under /api/admin
// behind requireAdmin (server.js). Thin: parse, call the lib/user-store.js
// facade; handle() maps its DomainErrors to HTTP (routes/_http.js).
//
//   GET    /api/admin/users                  list
//   POST   /api/admin/users                  create { email, display_name, password } (initial password)
//   PATCH  /api/admin/users/:email           { display_name?, status? }
//   PUT    /api/admin/users/:email/password  { password } → new initial password
//   DELETE /api/admin/users/:email

const express = require('express');
const users = require('../lib/user-store');
const { setContext } = require('../lib/log-context');
const logger = require('../logger');
const { handle } = require('./_http');

const router = express.Router();

// Every :email route: normalise + tag the log context first.
router.param('email', (req, res, next, raw) => {
  req.targetEmail = String(raw).trim().toLowerCase();
  setContext({ scope: 'admin', entity: req.targetEmail });
  next();
});

router.get('/users', handle(() => users.listUsers()));

router.post('/users', handle(async (req) => {
  const { email, display_name: displayName, password } = req.body || {};
  const created = await users.createUser({ email, displayName, password });
  setContext({ scope: 'admin', entity: created.email });
  logger.info('Benutzer angelegt.');
  return created;
}, { status: 201 }));

router.patch('/users/:email', handle((req) => {
  const { display_name: displayName, status } = req.body || {};
  const updated = users.updateUser(req.targetEmail, { displayName, status });
  if (status !== undefined) logger.info(`Benutzer-Status: ${status}.`);
  return updated;
}));

router.put('/users/:email/password', handle(async (req) => {
  const updated = await users.setInitialPassword(req.targetEmail, (req.body || {}).password);
  logger.info('Initialpasswort gesetzt.');
  return updated;
}));

router.delete('/users/:email', handle((req) => {
  users.deleteUser(req.targetEmail);
  logger.info('Benutzer gelöscht.');
  return { deleted: true };
}));

module.exports = router;
