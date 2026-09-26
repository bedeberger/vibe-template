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
const authEnv = require('./lib/auth-env');

// ── Production guard ──────────────────────────────────────────────────────
// NODE_ENV=production (set by the systemd unit, docs/deployment.md) must never
// come up with the dev bypass or the fallback session secret — fail the boot
// loudly instead of serving a login-free app with forgeable cookies.
const IS_PROD = process.env.NODE_ENV === 'production';
if (IS_PROD) {
  if (process.env.LOCAL_DEV_MODE === '1') throw new Error('LOCAL_DEV_MODE=1 ist in Produktion verboten.');
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen (openssl rand -hex 32).');
  }
  // The .env admin is the way into the admin console (docs/auth.md): a short
  // password there is a short password on the most powerful account.
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 16) {
    throw new Error('ADMIN_PASSWORD ist kürzer als 16 Zeichen (openssl rand -base64 24).');
  }
  if (process.env.ADMIN_PASSWORD && !process.env.ADMIN_EMAIL) {
    throw new Error('ADMIN_PASSWORD ohne ADMIN_EMAIL — der Admin-Login braucht beides.');
  }
}
// AUTH_METHOD must be a known value in every environment — fail at boot, not at
// the first login.
authEnv.authMethod();

const logger = require('./logger');
const { runWithContext, setContext } = require('./lib/log-context');

// DB setup + migrations run on import.
const { db } = require('./db/schema');
const appSettings = require('./lib/app-settings');
const { ensureAdminFromEnv, requireAuth, requireAdmin } = require('./lib/auth');
const { runDevSeedIfNeeded } = require('./lib/dev-seed');

const authRouter = require('./routes/auth');
const notesRouter = require('./routes/notes');
const adminUsersRouter = require('./routes/admin-users');
const jobsRouter = require('./routes/jobs'); // also registers the job runners + schedules
const scheduler = require('./routes/jobs/shared/scheduler');

// ── Boot-time bootstrap (idempotent) ───────────────────────────────────────
try { appSettings.bootstrapFromEnv(); } catch (e) { logger.warn(`settings bootstrap: ${e.message}`); }
try { ensureAdminFromEnv(); } catch (e) { logger.warn(`admin bootstrap: ${e.message}`); }
runDevSeedIfNeeded().catch((e) => logger.warn(`dev seed: ${e.message}`));

const app = express();
const PUBLIC_DIR = path.join(__dirname, 'public');

// Behind exactly one reverse proxy (Nginx Proxy Manager terminates TLS): trust
// its X-Forwarded-* so req.secure/req.ip are right and the Secure cookie is set.
if (IS_PROD) app.set('trust proxy', 1);

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
    cookie: { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 7 * 24 * 3600 * 1000 },
  })
);

// Wrap every request in a fresh log context, tagged with method+path.
app.use((req, res, next) => {
  runWithContext({ scope: 'http' }, () => {
    setContext({ entity: req.method + ' ' + req.path });
    next();
  });
});

// Health check for the deploy workflow and the proxy — before the auth guard,
// touches the DB so a broken schema/volume shows up as unhealthy.
app.get('/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(503).json({ status: 'error', error: e.message });
  }
});

// Auth guard on everything except public paths (handled inside requireAuth).
app.use(requireAuth);

// Routes.
app.use('/', authRouter);
app.use('/api/admin', requireAdmin, adminUsersRouter);
app.use('/api', notesRouter);
app.use('/api', jobsRouter);

// Client bootstrap config (timezone for date display, dev flag).
app.get('/api/config', (req, res) => {
  res.json({
    timezone: appSettings.getTimezone(),
    localDevMode: process.env.LOCAL_DEV_MODE === '1',
    authMethod: authEnv.authMethod(),
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

// The cron scheduler ticks only in a running server (never on import, so tests
// stay deterministic); SCHEDULER=off disables it, e.g. on a second instance.
function start() {
  if (process.env.SCHEDULER !== 'off') scheduler.start();
  return app.listen(PORT, () => logger.info(`vibe-template läuft auf http://localhost:${PORT}`));
}

// Start only when run directly, so tests can import `app` without a listener.
if (require.main === module) start();

module.exports = { app, start };
