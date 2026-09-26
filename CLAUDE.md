# vibe-template

Self-hosted SPA-Template: **Node + Express**, **better-sqlite3** (local-first),
**Alpine.js**-Frontend **ohne Build-Schritt** (natives ESM). Die
Beispiel-Domänenentität ist **`note`** (gehört zu einem **`notebook`**) — durch
die echte Entität ersetzen, die Patterns unten beibehalten.

**Diese Datei ist ein Wegweiser, kein Handbuch.** Sie trägt nur, was gelten muss,
*bevor* eine Datei geöffnet wird. Verzeichnislokale Regeln stehen in einer
`CLAUDE.md` in diesem Verzeichnis und laden automatisch, wenn dort gearbeitet
wird ("Wo die Regeln liegen"); tiefere Themen stehen in [docs/](docs/). Eine
Regel steht an genau **einer** Stelle. Jede `CLAUDE.md` beschreibt nur den
**aktuellen** Stand — keine Historie, kein "früher war"; `git log` ist die
Historie. **Warum:** diese Datei wird bei jedem Aufruf bezahlt, eine
verschachtelte nur bei Bedarf.

**Lokaler Start:** `npm install && npm run dev` (→ http://localhost:3000,
`LOCAL_DEV_MODE=1`: Login umgangen, Seed-Daten). Tests: `npm test`.
**Produktion:** ein LXC hinter Nginx Proxy Manager, deployt von einem
self-hosted Runner nach grüner CI auf `main` — [docs/deployment.md](docs/deployment.md).
**Git-Workflow:** trunk-based — direkt auf `main` committen, keine
Feature-Branches, keine PRs. Jeder Push auf `main` ist ein Produktions-Deploy
auf den LXC (sobald die CI grün ist), also erst pushen, wenn die Tests lokal
grün sind.

## Stack

- **Server:** Express, ein fester Port. Die gesamte HTTP-Verdrahtung (Setup,
  Auth-Guard, `/healthz`, Route-Mounting) lebt in [server.js](server.js). Unter
  `NODE_ENV=production` verweigert er den Boot mit `LOCAL_DEV_MODE=1` oder einem
  kurzen `SESSION_SECRET`, setzt das Cookie `Secure` und vertraut einem
  Proxy-Hop.
- **DB:** SQLite via better-sqlite3, `PRAGMA foreign_keys = ON`, nummerierte
  forward-only-Migrationen mit einem gesquashten Schnellpfad und einem
  eingefrorenen Lock-Register.
- **Frontend:** Vanilla-SPA + Alpine.js, kein Bundler; Drittcode committet in
  `public/vendor/`. **Styling:** reines CSS, Token-System, `@layer`-Cascade,
  Designsystem in [DESIGN.md](DESIGN.md).
- **Auth:** Session-Guard auf jeder Route ausser den öffentlichen. OIDC
  (anbieterunabhängig) + `LOCAL_DEV_MODE`-Bypass.
- **Logging:** Winston mit einem Kontext-Tag pro Request/Job, selbstrotierende
  Datei.
- **Tests:** Unit + Integration (`node --test`), E2E-Harnesses + Real-App-E2E
  (Playwright) — [docs/testing.md](docs/testing.md).
- **Keine AI** in diesem Template. Die Job-Queue ist generisch — dort würden
  AI-Aufrufe leben (nie synchron in einem Request).
- **Cron:** Scheduler im Prozess, reiht nur Jobs ein, rechnet in `app.timezone`
  — [routes/jobs/CLAUDE.md](routes/jobs/CLAUDE.md#zeitgesteuerte-jobs-cron).

## Harte Regeln (immer gültig)

- **Domänen-Facade als einziger Eintrittspunkt.** Eine Domäne wird nur über
  ihre Facade in `lib/` erreicht ([lib/note-store.js](lib/note-store.js)). Kein
  Roh-SQL gegen `notes`/`notebooks` aus Routen oder Jobs. **Warum:** ein Ort für
  Invarianten, Validierung und künftiges Caching.
- **Langläufer nur via Job-Queue.** Alles, was einen Request spürbar blockieren
  würde, läuft als Job-Typ in [routes/jobs/](routes/jobs/) (Dedup, Status,
  Lifecycle zentral). Details: [routes/jobs/CLAUDE.md](routes/jobs/CLAUDE.md).
- **UI-Strings nur in `public/js/i18n/{de,en}.json`.** Kein hartkodierter Text in
  HTML/JS/Alpine-Templates (inkl. `aria-label`, Placeholder, Tooltips); immer
  `t('area.field')`. Ein neuer String kommt in derselben Änderung in **beide**
  Locales (de = Fallback). Ausnahme: Winston-Logs bleiben deutsch, sie sind
  nicht nutzerseitig.
- **Self-hosted, alles aus dem eigenen Origin.** Kein CDN, kein externer
  Font/kein externes Script; vendorte Dateien sind versioniert + lizenziert und
  ändern sich nur via `npm run vendor:sync`. Die CSP bleibt `'self'`. Details:
  [public/CLAUDE.md](public/CLAUDE.md).
- **`x-html` nur mit vorab-escaptem Content** (`escHtml()`), kein
  Runtime-Sanitizer. **Warum:** eine einzige auditierbare Escape-Invariante.
- **Relationale Integrität.** Jede `*_id` ist ein echter FK, indiziert, mit
  bewusstem `ON DELETE`; keine Snapshot-Spalten; Migrationen forward-only, eine
  veröffentlichte wird nie umnummeriert oder editiert. Details: [db/CLAUDE.md](db/CLAUDE.md).
- **DB-Timestamps: ISO+Z via `NOW_ISO_SQL`**, nie `datetime('now')`. Anzeige
  nur via `tzOpts()`/`formatDate` (Frontend) und [lib/local-date.js](lib/local-date.js)
  (Server). **Warum:** `datetime('now')` hat kein Z und zeigt die UTC-Uhrzeit
  unter dem lokalen Label.
- **Feature-Registry ist SSoT, Features haben eine feste Anatomie.** Jeder
  Nav-Eintrag ist ein Registry-Eintrag ([public/js/app/features.js](public/js/app/features.js))
  mit Feature-Karte, Fachmodul, Partial, Entity-CSS, Harness + Spec — generiert
  von `npm run feature:new`, gegated durch `feature-registry.test`. Die Root ist
  nur die Shell. Details: [DESIGN.md → Feature-Anatomie](DESIGN.md#feature-anatomie).
- **DESIGN.md-Pattern-Katalog vor neuer UI prüfen.** Wiederverwenden; fehlt das
  Pattern, zuerst dort dokumentieren, dann bauen.
- **Styles nur in `public/css/`**, Tokens statt Rohwerte, jede Datei in einem
  Layer. Details: [public/css/CLAUDE.md](public/css/CLAUDE.md).
- **State explizit deklariert** — Root in `app-state.js`, Karten als
  Initialfelder (inkl. jedes Felds, das ihr Fachmodul zuweist); kein lazy
  `this._x`.
- **File-Limits / Modularität.** JS (Browser **und** Server) > 600 LOC,
  HTML-Partials > 250, CSS > 600 → in einen `<name>/`-Unterordner mit Facade
  aufteilen. Per Ratchet gegated durch `loc-limits.test`.
- **Logging-Kontext.** Jede Route füllt `[scope|user|entity|jobId]` via
  `setContext` ([lib/log-context.js](lib/log-context.js)); Jobs bekommen ihn von
  der Queue. **Warum:** ein durchsuchbarer Trace pro Request und dem Job, den er
  auslöst.

## Mechanisch durchgesetzt — nicht auswendig lernen

Hooks ([.claude/settings.json](.claude/settings.json), [scripts/hooks/](scripts/hooks/))
warnen/blocken beim Editieren; die Unit-Guards in [tests/unit/](tests/unit/) sind
das verbindliche Gate (CI). Regellogik geteilt in [scripts/hooks/_rules.js](scripts/hooks/_rules.js).
Ein Hook warnt, er lehrt nicht: die Alternative steht im Volltext der Regel.

| Regel | Durchsetzung | Wo |
|---|---|---|
| Keine Inline-`style`/`<style>` (nur `:style="{ '--x': … }"`) | `style-guard.js` **blockt** · `no-inline-style.test` | public/ |
| Kein natives `<select>` — `combobox` ([public/CLAUDE.md](public/CLAUDE.md)) | `style-guard.js` warnt | public/ |
| Kein `datetime('now')` — `${NOW_ISO_SQL}` | `style-guard.js` warnt · `architecture-tripwire.test` | db/, lib/, routes/, scripts/, public/js |
| Kein Roh-SQL auf `notes`/`notebooks`, kein `db/notes.js`-Import ausserhalb der Facade | `style-guard.js` warnt · `architecture-tripwire.test` | alles ausser db/ + lib/note-store.js |
| Jeder String in `de.json` **und** `en.json`, gleiche `{Platzhalter}`, kein verwaister/fehlender Key, kein Hardcode-Text | `i18n-check.js` · `i18n-locale-parity` / `i18n-keys-defined` / `i18n-no-hardcoded-text.test` | public/ |
| LOC-Caps (JS 600, Partial 250, CSS 600) | `loc-limits-check.js` · `loc-limits.test` | public/js, lib, routes, db, scripts, partials, css |
| Tokens statt Rohwerte, `@layer`-Pflicht, Selektor unique, keine toten Klassen | `spacing-scale` / `css-layers` / `dedup-tripwire` / `css-tokens-defined` / `css-dead-classes` / `css-comment-balance.test` | public/css |
| CSS-Datei ⇒ `<link>` in index.html + in jedem Harness + DESIGN.md-Inventar | `drift-reminders.js` · `design-css-inventory-drift` / `harness-css-parity.test` | public/css, index.html, tests/fixtures, DESIGN.md |
| Icons nur aus dem Lucide-Sprite, Icon-only mit `aria-label` + `data-tip` | `icons-sprite` / `button-icons` / `action-icons-tripwire` / `icon-size-consistency.test` | public/icons.svg, public/ |
| `x-html` nur über einen Getter mit `escHtml()` | `escape-xss.test` · Harness-Spec `notes-card.spec` | public/ |
| Self-hosted: keine externe URL, Vendor-Datei = Paketversion + Lizenz | `vendor-integrity.test` | public/, tests/fixtures |
| Feature-Anatomie vollständig (Karte registriert + Lifecycle, Fachmodul, Partial mit Karte als Wurzel, Entity-CSS, Harness + Spec); Nav + Hosts aus der Registry | `feature-registry.test` (Regeln: `scripts/feature-anatomy.js`) · `feature-new.test` · Smoke liest die Registry | public/, tests/fixtures, tests/e2e |
| State vorab deklariert; `req.params` ⇒ `setContext()` | `architecture-tripwire.test` | public/js, routes/ |
| FK für jede `*_id`, FK indiziert, bewusstes `ON DELETE`, `*_at` ISO+Z | `schema-integrity.test` | db/ |
| Migration ⇒ Squash-Fold + `squash:check` + `migrations:lock`; nie umnummerieren | `drift-reminders.js` · `squash-drift` / `migration-lock` / `migration-chain-boot.test` | db/ |
| deploy.yml ↔ sudoers/Unit aus prepare-lxc.sh | `deploy-contract.test` | .github/workflows, scripts/prepare-lxc.sh |
| Doku-Links/Anker gültig | `doc-links.test` | **/*.md |
| Definition of Done (Tests/Doku/Seed/Mobile zum geänderten Code) | `session-stop-check.js` (Turn-Ende, meldet je Kriterium einmal) · `dod-triggers.test` | db/, lib/, routes/, public/ |
| Mehrdeutige Sammelbegriffe im Prompt klären | `prompt-disambiguation.js` (injiziert Hinweis; Tabelle anfangs leer) | — |
| Unit-Tests vor dem Commit | `stop-run-unit-tests.js` (Turn-Ende, nicht blockierend) | — |
| Kein `git stash`/`checkout --`/`restore`/`reset --hard`/`clean`/Force-Push | `permissions.deny` | .claude/settings.json |

## Definition of Done

Eine Änderung ist fertig, wenn ihre **Art** von Code ihre **Art** von Nachweis
im selben Change-Set mitbringt. Der Stop-Hook (`session-stop-check.js`, Tabelle
in [scripts/hooks/_dod.js](scripts/hooks/_dod.js)) erinnert einmal pro Kriterium
und Session; das verbindliche Gate ist die CI. Bewusst ohne Bedarf (reines
Refactoring, nur Desktop)? Das sagen und aufhören.

| Geändert | Braucht |
|---|---|
| `db/`, `lib/`, `routes/`, `server.js` | Unit-Tests (tests/unit/) + Integration-Tests (tests/integration/) + Doku (docs/ bzw. README/CLAUDE/DESIGN) |
| `public/` (HTML/JS) | E2E/Smoke (tests/e2e/ bzw. tests/e2e-app/) + Doku (docs/ bzw. README/CLAUDE/DESIGN) |
| `public/` (HTML/JS/CSS) | Mobile-Check — der Hook nennt die Specs, die die Stelle in Handybreite testen, oder sagt, dass es keine gibt |
| `db/migrations/` | zusätzlich Dev-Seed (lib/dev-seed.js) — eine neue Tabelle ohne Daten sieht aus wie eine funktionierende View, in der nichts steht |

## Wo die Regeln liegen

| Datei | Inhalt |
|---|---|
| [db/CLAUDE.md](db/CLAUDE.md) | Modul-Aufteilung, Timestamps, FK-Pflicht + ON-DELETE-Wahl, Sentinel-Freiheit, forward-only, Recreate-Pattern |
| [lib/CLAUDE.md](lib/CLAUDE.md) | Facade-Vertrag, Log-Kontext, Server-Datum, Dev-Seed |
| [routes/CLAUDE.md](routes/CLAUDE.md) | dünne Routen, Validierung + Statuscodes, Log-Kontext, Mounting + öffentliche Pfade |
| [routes/jobs/CLAUDE.md](routes/jobs/CLAUDE.md) | neuen Job-Typ anlegen, Dedup, i18n-Status, Fehler, Cron-Zeitpläne |
| [public/CLAUDE.md](public/CLAUDE.md) | Self-hosting/Vendor, Registry, Partials + Karten, State, `x-html`, `api()` + 401, Datum |
| [public/css/CLAUDE.md](public/css/CLAUDE.md) | Tokens + Layer, Farben/Dark-Mode, Fonts + Icons, Karten-Akzent + Innenraum, Besitzer-Regel, neue CSS-Datei |
| [tests/CLAUDE.md](tests/CLAUDE.md) | die vier Schichten, Temp-DB, Console-Guard, Harness vs. App, Mutationsprüfung |
| [DESIGN.md](DESIGN.md) | UI-Muster-Katalog, **Feature-Anatomie**, CSS-Inventar |

## Doku-Index

Die Doku **vor** einer Änderung in ihrem Bereich lesen.
[deployment.md](docs/deployment.md) LXC, Runner, Nginx Proxy Manager, Deploy +
Rollback, Betrieb · [migrations.md](docs/migrations.md) Squash, Lock,
Renumber, Pending-Zähler · [testing.md](docs/testing.md) welche Suite wann,
Harness, Console-Guard, Fallen · [DESIGN.md](DESIGN.md) UI-Muster-Katalog +
CSS-Inventar.

## Feature hinzufügen

`/feature` führt durch. Kurzfassung:

1. **Frontend-Gerüst:** `npm run feature:new -- <id> --label-de … --label-en …
   --icon …` — Karte, Fachmodul, Partial, Entity-CSS, Harness + Spec und jede
   Registrierung (Registry, Karten-Inventar, Links, DESIGN.md-Inventar, i18n in
   beiden Locales). Stattdessen eine Karte in einem bestehenden Feature: `/karte`.
2. **i18n:** jeder weitere String in `de.json` und `en.json`.
3. **Backend (Daten):** Domänen-DB-Modul in `db/`, **Facade** in `lib/`, Router
   in `routes/` (importiert nur die Facade), gemountet in [server.js](server.js).
4. **Backend (lange Operation):** `routes/jobs/<type>.js` (registriert seinen
   Runner), eingetragen in [routes/jobs/index.js](routes/jobs/index.js),
   eingereiht via `queue.createJob(type, entityId)`.
5. **Migration:** `/migration` — `db/migrations/000N_*.js`, in das passende
   `db/squashed-schema/`-Segment folden, `SQUASHED_VERSION` erhöhen,
   `npm run squash:check`, `npm run migrations:lock` (derselbe Commit).
   Kollidierende Nummer nach einem Rebase: `npm run migration:renumber`.
6. **Frontend:** das generierte Fachmodul + Karte + Partial füllen
   ([DESIGN.md → Feature-Anatomie](DESIGN.md#feature-anatomie)), CSS gemäss
   [public/css/CLAUDE.md](public/css/CLAUDE.md).
7. **Tests:** Unit (Facade, reine Helfer), Integration (API), die generierte
   Harness-Spec + ihre Mocks in `tests/server.js`, `npm run test:smoke`. Neue
   Guard-Tests: `/regel` (einmal mutationsprüfen; geteilte Regellogik in
   `scripts/hooks/_rules.js`).

## Befehle

```bash
npm run dev                 # LOCAL_DEV_MODE=1 + node --watch
npm start                   # schlichter Server
npm test                    # Unit + Integration + E2E + E2E-App
npm run test:unit           # inkl. aller statischen Guards
npm run test:integration
npm run test:e2e            # Fixture-Harnesses (Mock-Server)
npm run test:e2e-app        # echte App; test:smoke = nur die Smoke-Spec
npm run db:migrate          # ausstehende Migrationen eigenständig anwenden
npm run squash:check        # nur das Schema-Drift-Gate
npm run migrations:lock     # Migrationskette einfrieren (Lock committen)
npm run migration:renumber  # eigene ungepushte Migration → max(origin/main)+1
npm run vendor:sync         # Browser-Libs nach devDependency-Bump neu vendoren
npm run feature:new -- <id> # Frontend-Feature scaffolden (zuerst --dry-run)
npm run init -- <slug> --title "…"  # frischen Klon zum eigenen Projekt umbenennen
```

Claude-Befehle ([.claude/commands/](.claude/commands/)): `/feature` (neues
Feature end to end), `/karte` (Karte/Tab in einem bestehenden Feature),
`/migration`, `/regel` (neue harte Regel: Gate-Test zuerst), `/release`,
`/projekt-init` (frischer Klon → eigenes Projekt). Skill `css`
([.claude/skills/css/](.claude/skills/css/)): vor CSS-Arbeit messen
(`audit.mjs`). VS Code: Tasks (`gate` ist der Default-Build-Task),
Debug-Profile und Test-Explorer in [.vscode/](.vscode/).
