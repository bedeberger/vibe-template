'use strict';
// Single server entry point: Express setup, session, logging context, the auth
// guard, static serving and route mounting all live here (CLAUDE.md → the whole
// HTTP surface is wired in one file). Importing it (without running) returns the
// app for in-process tests; running it directly starts the listener.

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);

const logger = require('./logger');
const { runWithContext, setContext } = require('./lib/log-context');

// DB setup + migrations run on import.
const { db } = require('./db/schema');
const appSettings = require('./lib/app-settings');
const { ensureAdminFromEnv, requireAuth } = require('./lib/auth');
const { ensureVendor } = require('./lib/vendor');
const { runDevSeedIfNeeded } = require('./lib/dev-seed');

// Registering the job runner has the side effect of wiring it into the queue.
require('./lib/jobs/example-job');

const authRouter = require('./routes/auth');
const notesRouter = require('./routes/notes');
const jobsRouter = require('./routes/jobs');

// ── Boot-time bootstrap (idempotent) ───────────────────────────────────────
try { appSettings.bootstrapFromEnv(); } catch (e) { logger.warn(`settings bootstrap: ${e.message}`); }
try { ensureAdminFromEnv(); } catch (e) { logger.warn(`admin bootstrap: ${e.message}`); }
try { ensureVendor(); } catch (e) { logger.warn(`vendor copy: ${e.message}`); }
try { runDevSeedIfNeeded(); } catch (e) { logger.warn(`dev seed: ${e.message}`); }

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Alpine evaluates expressions via Function() → needs 'unsafe-eval'.
        scriptSrc: ["'self'", "'unsafe-eval'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(express.json());

app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 },
  })
);

// Wrap every request in a fresh log context, tagged with method+path.
app.use((req, res, next) => {
  runWithContext({ scope: 'http' }, () => {
    setContext({ entity: req.method + ' ' + req.path });
    next();
  });
});

// Auth guard on everything except public paths (handled inside requireAuth).
app.use(requireAuth);

// Routes.
app.use('/', authRouter);
app.use('/api', notesRouter);
app.use('/api', jobsRouter);

// Client bootstrap config (timezone for date display, dev flag).
app.get('/api/config', (req, res) => {
  res.json({
    timezone: appSettings.getTimezone(),
    localDevMode: process.env.LOCAL_DEV_MODE === '1',
  });
});

// Static assets + SPA shell.
app.use(express.static(PUBLIC_DIR));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// JSON 404 for unknown API routes; everything else falls back to the SPA.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not found' });
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;

function start() {
  return app.listen(PORT, () => logger.info(`vibe-template läuft auf http://localhost:${PORT}`));
}

// Start only when run directly, so tests can import `app` without a listener.
if (require.main === module) start();

module.exports = { app, start };
