'use strict';
// Admin console — user management (docs/auth.md). Mounted under /api/admin
// behind requireAdmin (server.js). Thin: parse, call the lib/user-store.js
// facade, map its domain errors to HTTP.
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

const router = express.Router();

const STATUS_BY_ERROR = {
  'not found': 404,
  'user exists': 409,
  'managed by env': 409,
};

function sendError(res, e) {
  const status = STATUS_BY_ERROR[e.message] || 400;
  res.status(status).json({ error: e.message });
}

// Every :email route: normalise + tag the log context first.
router.param('email', (req, res, next, raw) => {
  req.targetEmail = String(raw).trim().toLowerCase();
  setContext({ scope: 'admin', entity: req.targetEmail });
  next();
});

router.get('/users', (req, res) => {
  res.json(users.listUsers());
});

router.post('/users', async (req, res) => {
  const { email, display_name: displayName, password } = req.body || {};
  try {
    const created = await users.createUser({ email, displayName, password });
    setContext({ scope: 'admin', entity: created.email });
    logger.info('Benutzer angelegt.');
    res.status(201).json(created);
  } catch (e) { sendError(res, e); }
});

router.patch('/users/:email', (req, res) => {
  const { display_name: displayName, status } = req.body || {};
  try {
    const updated = users.updateUser(req.targetEmail, { displayName, status });
    if (status !== undefined) logger.info(`Benutzer-Status: ${status}.`);
    res.json(updated);
  } catch (e) { sendError(res, e); }
});

router.put('/users/:email/password', async (req, res) => {
  try {
    const updated = await users.setInitialPassword(req.targetEmail, (req.body || {}).password);
    logger.info('Initialpasswort gesetzt.');
    res.json(updated);
  } catch (e) { sendError(res, e); }
});

router.delete('/users/:email', (req, res) => {
  try {
    users.deleteUser(req.targetEmail);
    logger.info('Benutzer gelöscht.');
    res.json({ deleted: true });
  } catch (e) { sendError(res, e); }
});

module.exports = router;
