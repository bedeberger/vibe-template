# vibe-template

A self-hosted SPA starter built on a deliberately small, dependency-light stack:

- **Node + Express** — single server, one port, all wiring in `server.js`.
- **better-sqlite3** — local-first SQLite, `foreign_keys = ON`, numbered
  forward-only migrations with a squashed fast path and a frozen lock register.
- **Alpine.js, no build step** — native ESM, Alpine vendored from node_modules.
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
npm start                   # → http://localhost:3000   (or: npm run dev)
```

In `LOCAL_DEV_MODE` the auth guard auto-authenticates you as `DEV_USER_EMAIL`
and a seed notebook with two notes is created on first boot. No login needed.

## Project layout

```
server.js          Express setup, auth guard, /healthz, route mounting
db/                connection · now · migrations/ · migrations.lock.json · schema · squashed-schema/ · <domain>
lib/               facades, auth, settings, logging context, job queue, vendor copy
routes/            HTTP handlers (call facades, never raw SQL)
public/            SPA: index.html, css/ (tokens + layers), fonts/, js/ (app, cards, i18n), partials/
scripts/           migrate · migrations-lock · migration-renumber · pending-migrations · prepare-lxc.sh
tests/             unit · integration · e2e · smoke
docs/              deployment · migrations
.github/workflows/ ci (tests) · deploy (self-hosted LXC runner)
.claude/commands/  /feature · /migration · /release
```

## Configuration

All config is via environment (`.env`, see `.env.example`):

| Var | Purpose |
| --- | --- |
| `PORT` | Server port (default 3000) |
| `SESSION_SECRET` | Signs session cookies — set a random value in prod |
| `DB_PATH` | SQLite file path (default `./app.db`) |
| `LOG_PATH` / `LOG_LEVEL` | Log file (default `./app.log`, self-rotating 5 MB × 5) / Winston level |
| `NODE_ENV` | `production` → Secure cookie, `trust proxy`, boot refuses `LOCAL_DEV_MODE` and a short `SESSION_SECRET` (set by the systemd unit) |
| `APP_TIMEZONE` | IANA tz for date display (seeds `app.timezone`) |
| `LOCAL_DEV_MODE` | `1` = bypass OIDC + seed data (local only) |
| `DEV_USER_EMAIL` | Identity used in dev mode |
| `ADMIN_EMAIL` | Gets `global_role=admin` at boot |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` | OIDC login (prod) |

## Tests

```bash
npm test                 # all layers
npm run test:unit        # facade / pure logic + migration gates (drift, lock, chain)
npm run test:integration # HTTP API against a temp DB
npm run test:e2e         # Playwright (needs: npx playwright install chromium)
npm run test:smoke       # app boots, main view opens, no console errors
```

## Deployment (self-hosted)

One LXC container (Ubuntu 24.04, Proxmox) behind **Nginx Proxy Manager**.
[scripts/prepare-lxc.sh](scripts/prepare-lxc.sh) provisions it (Node, users,
hardened systemd unit, sudoers, GitHub runner); after that every green CI run on
`main` deploys automatically ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
DB backup → migration dry run on a copy → rsync → restart → `/healthz` →
rollback on failure. Step-by-step guide incl. the NPM proxy host:
[docs/deployment.md](docs/deployment.md).

## License

MIT — see [LICENSE](LICENSE).
