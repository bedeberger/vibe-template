# vibe-template

Selbst gehostetes SPA-Grundgerüst auf einem bewusst kleinen Stack mit wenigen
Abhängigkeiten:

- **Node + Express** — ein Server, ein Port, die ganze Verdrahtung in `server.js`.
- **better-sqlite3** — lokal-zuerst SQLite, `foreign_keys = ON`, nummerierte
  Forward-only-Migrationen mit Squash-Schnellpfad und eingefrorenem Lock-Register.
- **Alpine.js, kein Build-Schritt** — natives ESM, Alpine aus node_modules vendort.
- **Plain CSS** — Token-System, `@layer`-Kaskade, keine Inline-Styles.
- **Auth** — Session-Guard überall; lokale Benutzerverwaltung als Default (Admin-Konsole),
  optional OIDC; der Admin meldet sich nur über `ADMIN_EMAIL` + `ADMIN_PASSWORD` aus der `.env`
  an ([docs/auth.md](docs/auth.md)). Zwei Sichten: User und Admin.
- **Winston-Logging**, **i18n (de/en)**, **eine generische Hintergrund-Job-Queue**
  mit **Cron-Scheduler** (reiht Jobs zeitgesteuert ein, in der App-Zeitzone).

Die Beispiel-Domäne ist eine **Note** (gehört zu einem **Notebook**). Ersetze sie
durch die eigene Entität — es geht um die Muster (Facade, Job-Queue, Migrationen,
Registry, Tokens). Die Architekturregeln stehen in [CLAUDE.md](CLAUDE.md).

## Schnellstart

Voraussetzung: Node 20–25 (`engines` in `package.json`).

```bash
git clone <this repo>
cd vibe-template
cp .env.example .env        # LOCAL_DEV_MODE=1 ist für lokal bereits gesetzt
npm install
npm start                   # → http://localhost:3000   (oder: npm run dev)
```

Im `LOCAL_DEV_MODE` meldet dich der Auth-Guard automatisch als `DEV_USER_EMAIL`
an (als Admin, mit beiden Sichten), und beim ersten Start entstehen ein
Seed-Notebook mit zwei Notes und zwei lokale Benutzer (`anna@local`,
`ben@local`, Initialpasswort `dev-passwort-123`). Kein Login nötig.

Dieser Klon ist zum Ausprobieren: `origin` zeigt aufs Template-Repo, ein Push
ginge dorthin. Für ein eigenes Projekt den nächsten Abschnitt nehmen.

## Eigenes Projekt starten

Auf GitHub *Use this template* → eigenes Repo (ohne Template-Historie), dieses
klonen und `npm install`. Danach benennen — **einer** der beiden Wege, nicht
beide nacheinander:

**Mit Claude Code (empfohlen):** im Projektordner Claude Code starten und

```
/projekt-init invoice-hub "Invoice Hub"
```

Der Befehl braucht einen sauberen Working Tree, führt das Script aus (erst
`--dry-run`, dann echt, inkl. `npm run test:unit`) und begleitet durch den Rest:
Remote prüfen, `.env` anlegen, Deploy-Variablen, Lizenz/Icon, später Ablösen des
`note`-Beispiels.

**Von Hand:**

```bash
npm run init -- invoice-hub --title "Invoice Hub" --dry-run   # zeigt die Dateien
npm run init -- invoice-hub --title "Invoice Hub"
cp .env.example .env
```

Der Slug (kebab-case) wird Paketname, systemd-Unit, `/opt/<slug>` und
Runner-Label — später ändern heisst, das LXC neu aufzusetzen. Der Titel erscheint
in der UI, im Browser-Tab und im Manifest. Das Skript setzt ausserdem
`CHANGELOG.md` und die Version auf 0.1.0 zurück und führt `npm run test:unit`
aus. Was es nicht erledigt (GitHub-Variablen `APP_NAME`/`DEPLOY_ENABLED`, LXC,
Lizenz, Icon): [.claude/commands/projekt-init.md](.claude/commands/projekt-init.md)
§3 und [docs/deployment.md](docs/deployment.md).

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
.claude/           commands (/feature · /karte · /migration · /regel · /release · /projekt-init) · skills (css) · settings (Hooks)
```

Ein neues Frontend-Feature: `npm run feature:new -- <id>` (Anatomie: DESIGN.md →
Feature-Anatomie). Die Regeln liegen beim Code: je ein `CLAUDE.md` in `db/`,
`lib/`, `routes/`, `routes/jobs/`, `public/`, `public/css/` und `tests/` (lädt
Claude Code automatisch, wenn dort gearbeitet wird); das Root-[CLAUDE.md](CLAUDE.md)
ist die Karte.

## Konfiguration

Zwei Orte, bewusst getrennt (CLAUDE.md → „`.env` nur minimal"):

**Admin-Konsole → Einstellungen** — alles, was der Admin selbst und sofort
ändern können soll, ohne Neustart (`lib/app-settings.js`):

| Tab | Einstellung |
| --- | --- |
| Allgemein | Zeitzone (Datumsanzeige + Job-Zeitpläne) |
| Anmeldung | Login-Methode (lokal / OIDC), OIDC-Issuer, Client-ID, Redirect-URI |
| Jobs | Aufbewahrung erledigter Jobs (Tage) |

**`.env`** (siehe `.env.example`) — nur Secrets, Bootstrap vor der DB und
Schalter pro Prozess:

| Var | Zweck |
| --- | --- |
| `SESSION_SECRET` | Signiert die Session-Cookies — in Prod ≥ 32 Zeichen |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Der Admin; meldet sich immer mit diesem Passwort an, auch bei OIDC |
| `OIDC_CLIENT_SECRET` | Secret zum OIDC-Client (der Rest steht in der Konsole) |
| `PORT` | Server-Port (Standard 3000) |
| `DB_PATH` | Pfad der SQLite-Datei (Standard `./app.db`) |
| `LOG_PATH` / `LOG_LEVEL` | Log-Datei (Standard `./app.log`, rotiert selbst 5 MB × 5) / Winston-Level |
| `SCHEDULER` | `off` schaltet den Cron-Scheduler dieses Prozesses ab |
| `NODE_ENV` | `production` → Secure-Cookie, `trust proxy`, Boot verweigert `LOCAL_DEV_MODE` und ein kurzes `SESSION_SECRET` (setzt die systemd-Unit) |
| `LOCAL_DEV_MODE` / `DEV_USER_EMAIL` | `1` = Login umgehen + Seed-Daten, Identität im Dev-Modus (nur lokal) |

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
