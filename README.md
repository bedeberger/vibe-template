# vibe-template

A self-hosted SPA starter built on a deliberately small, dependency-light stack:

- **Node + Express** — single server, one port, all wiring in `server.js`.
- **better-sqlite3** — local-first SQLite, `foreign_keys = ON`, numbered migrations.
- **Alpine.js, no build step** — native ESM, Alpine vendored from node_modules.
- **PWA** — service worker with a bumpable shell-cache constant.
- **Plain CSS** — design-token system, `@layer` cascade, no inline styles.
- **Auth** — session guard everywhere; OIDC in prod, `LOCAL_DEV_MODE` bypass locally.
- **Winston logging**, **i18n (de/en)**, **a generic background-job queue**.

The example domain is a **note** (owned by a **notebook**). Replace it with your
own entity — the patterns (facade, job queue, migrations, registry, tokens) are
the point. See [CLAUDE.md](CLAUDE.md) for the architecture rules.

## Quick start

```bash
git clone <this repo>
cd vibe-template
cp .env.example .env        # LOCAL_DEV_MODE=1 is already set for local use
npm install
npm start                   # → http://localhost:3000
```

In `LOCAL_DEV_MODE` the auth guard auto-authenticates you as `DEV_USER_EMAIL`
and a seed notebook with two notes is created on first boot. No login needed.

## Project layout

```
server.js          Express setup, auth guard, route mounting
db/                connection · now · migrations · schema · squashed-schema · <domain>
lib/               facades, auth, settings, logging context, job queue, vendor copy
routes/            HTTP handlers (call facades, never raw SQL)
public/            SPA: index.html, css/ (tokens + layers), js/ (app, cards, i18n), partials/
tests/             unit · integration · e2e · smoke
```

## Configuration

All config is via environment (`.env`, see `.env.example`):

| Var | Purpose |
| --- | --- |
| `PORT` | Server port (default 3000) |
| `SESSION_SECRET` | Signs session cookies — set a random value in prod |
| `DB_PATH` | SQLite file path (default `./app.db`) |
| `APP_TIMEZONE` | IANA tz for date display (seeds `app.timezone`) |
| `LOCAL_DEV_MODE` | `1` = bypass OIDC + seed data (local only) |
| `DEV_USER_EMAIL` | Identity used in dev mode |
| `ADMIN_EMAIL` | Gets `global_role=admin` at boot |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` | OIDC login (prod) |

## Tests

```bash
npm test                 # all layers
npm run test:unit        # facade / pure logic + schema-drift gate
npm run test:integration # HTTP API against a temp DB
npm run test:e2e         # Playwright (needs: npx playwright install chromium)
npm run test:smoke       # app boots, main view opens, no console errors
```

## Deployment (self-hosted)

Intended for an LXC container / systemd unit behind an HTTPS reverse proxy
(NGINX). Sketch:

1. Provision Node 20–25, clone the repo, `npm ci`.
2. Create `.env` with `LOCAL_DEV_MODE=0`, a strong `SESSION_SECRET`, the `OIDC_*`
   values and an absolute `DB_PATH` on a persistent volume.
3. Run `node server.js` under systemd (restart on failure, `WorkingDirectory`
   set, env from the `.env`).
4. NGINX terminates TLS and proxies to `127.0.0.1:$PORT`; forward
   `X-Forwarded-*` headers.

Migrations run automatically on boot; back up the SQLite file (and its `-wal`)
before upgrades.

## License

MIT — see [LICENSE](LICENSE).
