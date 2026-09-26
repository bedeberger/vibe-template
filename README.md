# vibe-template

Selbst gehostetes SPA-Grundgerüst auf einem bewusst kleinen Stack mit wenigen
Abhängigkeiten:

- **Node + Express** — ein Server, ein Port, die ganze Verdrahtung in `server.js`.
- **better-sqlite3** — lokal-zuerst SQLite, `foreign_keys = ON`, nummerierte
  Forward-only-Migrationen mit Squash-Schnellpfad und eingefrorenem Lock-Register.
- **Alpine.js, kein Build-Schritt** — natives ESM, Alpine aus node_modules vendort.
- **Plain CSS** — Token-System, `@layer`-Kaskade, keine Inline-Styles.
- **Auth** — Session-Guard überall; OIDC in Prod, lokal `LOCAL_DEV_MODE`-Bypass.
- **Winston-Logging**, **i18n (de/en)**, **eine generische Hintergrund-Job-Queue**
  mit **Cron-Scheduler** (reiht Jobs zeitgesteuert ein, in der App-Zeitzone).

Die Beispiel-Domäne ist eine **Note** (gehört zu einem **Notebook**). Ersetze sie
durch die eigene Entität — es geht um die Muster (Facade, Job-Queue, Migrationen,
Registry, Tokens). Die Architekturregeln stehen in [CLAUDE.md](CLAUDE.md).

## Schnellstart

```bash
git clone <this repo>
cd vibe-template
cp .env.example .env        # LOCAL_DEV_MODE=1 ist für lokal bereits gesetzt
npm install
npm start                   # → http://localhost:3000   (oder: npm run dev)
```

Im `LOCAL_DEV_MODE` meldet dich der Auth-Guard automatisch als `DEV_USER_EMAIL`
an, und beim ersten Start entsteht ein Seed-Notebook mit zwei Notes. Kein Login
nötig.

## Eigenes Projekt starten

Ein Repo aus diesem erstellen (GitHub: *Use this template*, ohne
Template-Historie), klonen, dann benennen:

```bash
npm install
npm run init -- invoice-hub --title "Invoice Hub"   # zuerst --dry-run, zeigt die Dateien
```

Der Slug (kebab-case) wird Paketname, systemd-Unit, `/opt/<slug>` und
Runner-Label; der Titel erscheint in der UI, im Browser-Tab und im Manifest. Das
Skript setzt ausserdem `CHANGELOG.md` und die Version auf 0.1.0 zurück und führt
`npm run test:unit` aus. In Claude Code führt `/projekt-init` es aus und begleitet
durch den Rest (Remote, `.env`, Deploy-Variablen, später Ablösen des
`note`-Beispiels).

## Projektstruktur

```
server.js          Express-Setup, Auth-Guard, /healthz, Routen-Mounting
db/                connection · now · migrations/ · migrations.lock.json · schema · squashed-schema/ · <domain>
lib/               Domänen-Facades, Auth, Settings, Log-Kontext, lokales Datum, Dev-Seed
routes/            HTTP-Handler (rufen Facades, nie Roh-SQL)
routes/jobs/       eine Datei je Hintergrund-Job-Typ (+ optional Cron-Zeitplan) + shared/queue.js, shared/scheduler.js
public/            SPA: index.html (Shell), partials/<feature>.html, css/ (Tokens + Layer,
                   entities/<feature>.css), fonts/, icons.svg, vendor/ (committete Builds + LICENSES)
public/js/         app.js (Boot) · app/ (Registry, Karten-Inventar, Router, Feature-Host, State) ·
                   cards/ (Feature-Karten + Lifecycle) · <feature>/ (Fachmodule) · i18n/
scripts/           migrate · migrations-lock · migration-renumber · pending-migrations ·
                   vendor-sync · feature-new (+ templates/feature/) · with-env · prepare-lxc.sh · hooks/
tests/             unit · integration · e2e (Fixture-Harnesses) · e2e-app (echte App) · fixtures
docs/              deployment · migrations · testing
.github/workflows/ ci (Tests) · deploy (self-hosted LXC-Runner)
.claude/           commands (/feature · /karte · /migration · /regel · /release) · skills (css) · settings (Hooks)
```

Ein neues Frontend-Feature: `npm run feature:new -- <id>` (Anatomie: DESIGN.md →
Feature-Anatomie). Die Regeln liegen beim Code: je ein `CLAUDE.md` in `db/`,
`lib/`, `routes/`, `routes/jobs/`, `public/`, `public/css/` und `tests/` (lädt
Claude Code automatisch, wenn dort gearbeitet wird); das Root-[CLAUDE.md](CLAUDE.md)
ist die Karte.

## Konfiguration

Die ganze Konfiguration läuft über die Umgebung (`.env`, siehe `.env.example`):

| Var | Zweck |
| --- | --- |
| `PORT` | Server-Port (Standard 3000) |
| `SESSION_SECRET` | Signiert die Session-Cookies — in Prod einen Zufallswert setzen |
| `DB_PATH` | Pfad der SQLite-Datei (Standard `./app.db`) |
| `LOG_PATH` / `LOG_LEVEL` | Log-Datei (Standard `./app.log`, rotiert selbst 5 MB × 5) / Winston-Level |
| `NODE_ENV` | `production` → Secure-Cookie, `trust proxy`, Boot verweigert `LOCAL_DEV_MODE` und ein kurzes `SESSION_SECRET` (setzt die systemd-Unit) |
| `APP_TIMEZONE` | IANA-Zeitzone für die Datumsanzeige (Seed für `app.timezone`) |
| `LOCAL_DEV_MODE` | `1` = OIDC umgehen + Seed-Daten (nur lokal) |
| `DEV_USER_EMAIL` | Identität im Dev-Modus |
| `ADMIN_EMAIL` | Erhält beim Boot `global_role=admin` |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` | OIDC-Login (Prod) |

## Tests

```bash
npm test                 # alle Schichten
npm run test:unit        # reine Logik, Facades, statische Guards (Migrationen, CSS, i18n, LOC, Vendor …)
npm run test:integration # HTTP-API + Job-Queue gegen eine Temp-DB
npm run test:e2e         # Playwright: Fixture-Harnesses gegen einen Mock-Server
npm run test:e2e-app     # Playwright: die echte App (Smoke + Verhalten)
npm run test:smoke       # nur der Registry-getriebene Smoke
```

Beim ersten Mal: `npx playwright install chromium`. Konzept: [docs/testing.md](docs/testing.md).

## Deployment (self-hosted)

Ein LXC-Container (Ubuntu 24.04, Proxmox) hinter **Nginx Proxy Manager**.
[scripts/prepare-lxc.sh](scripts/prepare-lxc.sh) richtet ihn ein (Node, Benutzer,
gehärtete systemd-Unit, sudoers, GitHub-Runner); danach deployt jeder grüne
CI-Lauf auf `main` automatisch ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)):
DB-Backup → Migrations-Probelauf auf einer Kopie → rsync → Restart → `/healthz` →
Rollback bei Fehler. Schritt-für-Schritt-Anleitung inkl. NPM-Proxy-Host:
[docs/deployment.md](docs/deployment.md).

**Git-Workflow:** direkt auf `main` arbeiten, keine Feature-Branches oder PRs.
Ein Push auf `main` ist ein Produktions-Deploy, also vor dem Push `npm test`
laufen lassen.

## Lizenz

MIT — siehe [LICENSE](LICENSE).
