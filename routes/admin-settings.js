'use strict';
// Admin console — app settings (CLAUDE.md ".env nur minimal"). Mounted under
// /api/admin behind requireAdmin (server.js). Thin: the lib/app-settings.js
// facade validates and stores; this maps its DomainErrors to HTTP.
//
//   GET   /api/admin/settings   { tabs, settings: [{ key, tab, type, value, … }], env }
//   PATCH /api/admin/settings   { <key>: <value>, … } → same shape (all-or-nothing)
//
// `env` reports what the console cannot change but must explain: whether the
// OIDC client secret is present in .env (never its value).

const express = require('express');
const appSettings = require('../lib/app-settings');
const { setContext } = require('../lib/log-context');
const { handle } = require('./_http');
const logger = require('../logger');

const router = express.Router();

function view() {
  return {
    tabs: appSettings.TABS,
    settings: appSettings.list(),
    env: { oidcClientSecret: !!process.env.OIDC_CLIENT_SECRET },
  };
}

router.get('/settings', handle(() => view()));

router.patch('/settings', handle((req) => {
  setContext({ scope: 'admin', entity: 'settings' });
  const changed = appSettings.update(req.body);
  if (changed.length) logger.info(`Einstellungen geändert: ${changed.join(', ')}.`);
  return view();
}));

module.exports = router;
