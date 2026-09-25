---
description: Neues Feature nach dem CLAUDE.md-Rezept anlegen (Registry/i18n/Facade/Job/Migration/Karte/Tests)
argument-hint: "[Feature-Beschreibung]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run test:unit:*), Bash(npm run test:integration:*), Bash(npm run test:e2e:*), Bash(npm run test:smoke:*), Bash(npm run squash:check:*), Bash(npm run migrations:lock:*), Bash(git status:*), Bash(git diff:*)
---

Du legst ein neues Feature an: **$ARGUMENTS**

Arbeite die relevanten Schritte der CLAUDE.md-Sektion „Add a feature" ab. **Nicht blind alles** — zuerst den Scope klären, dann nur die zutreffenden Teile.

## 0. Scope klären (zuerst!)

Bestimme (bei Unklarheit **nachfragen**, nicht raten):
- **Neue Domäne / neue Daten?** → Teil A (DB-Modul + Facade + Routes).
- **Schema-Änderung?** → erst `/migration` ausführen (oder dessen Schritte), dann hier weiter.
- **Langläufer?** Alles, was einen Request spürbar blockieren würde (Import, Export, Batch, externer Call, später KI), läuft als Job (Harte Regel „Langläufer nur via Job-Queue"). → Teil B.
- **Eigene UI?** Neue Ansicht in der Navigation und/oder neue Karte. → Teil C.

## Teil A — Backend (Daten)

1. Domänen-DB-Modul unter `db/<domäne>.js` (Muster: [db/notes.js](db/notes.js)) — prepared Statements, `${NOW_ISO_SQL}` ([db/now.js](db/now.js)) für jeden `*_at`-Wert, **nie** `datetime('now')`.
2. **Facade** unter `lib/<domäne>-store.js` (Muster: [lib/note-store.js](lib/note-store.js)): Validierung + Invarianten hier, nicht in der Route. Routes und Jobs importieren **nur die Facade** — kein Roh-SQL ausserhalb von `db/` (Harte Regel „Domänen-Facade").
3. Router unter `routes/<domäne>.js` (Muster: [routes/notes.js](routes/notes.js)), in [server.js](server.js) mounten.
4. **Logging-Context:** jede Route setzt `setContext({ entity: … })` ([lib/log-context.js](lib/log-context.js)) nach der ID-Validierung.

## Teil B — Backend (Job)

1. Runner unter `lib/jobs/<name>.js` registrieren (Muster: [lib/jobs/example-job.js](lib/jobs/example-job.js)), in [server.js](server.js) per `require` einhängen.
2. Enqueue über `queue.createJob(type, entityId)` — Dedup ist eingebaut; kein zweiter paralleler Job für dieselbe Entity.
3. Statustexte/Labels als i18n-Keys (`job.xxx`), nicht als fertiger Text.
4. Den Log-Kontext `[job|…|entity|jobId]` setzt die Queue selbst (`runWithContext` in [lib/jobs/queue.js](lib/jobs/queue.js)) — im Runner nichts nachbauen, nur bei Bedarf per `setContext` ergänzen.

## Teil C — Frontend

**Vor neuer UI: [DESIGN.md](DESIGN.md)-Pattern-Katalog prüfen** — wiederverwenden, nicht neu erfinden. Fehlt das Pattern: erst dort dokumentieren (Markup + CSS-Datei + Use-Case), dann bauen.

1. **Registry:** Eintrag in [public/js/app/features.js](public/js/app/features.js) (`id`, `icon`, `labelKey`, `view`) — die Navigation rendert sich daraus. Keine handgepflegte Nav-Liste.
2. **Ansicht** als Partial `public/partials/<view>.html` + `<section data-partial="<view>">` in [public/index.html](public/index.html).
3. **Karten** als `Alpine.data`-Sub-Komponente unter `public/js/cards/<name>-card.js` (Muster: [note-card.js](public/js/cards/note-card.js)), in [public/js/app.js](public/js/app.js) registrieren. State **explizit** als Initial-Felder deklarieren (kein lazy `this._x`); Root-State in [app-state.js](public/js/app/app-state.js).
4. **`x-html` nur mit `escHtml()`-vorescaptem Content** ([public/js/utils.js](public/js/utils.js)).
5. **Styles:** nur in `public/css/` (kein Inline-`style`, kein `<style>`), Werte nur aus Tokens. Entity-CSS unter `public/css/entities/`, neue Datei als `<link>` in index.html + Zeile im CSS-Inventar von DESIGN.md.

## Querschnitt (immer)

- **i18n:** jeder neue sichtbare String sofort in `de.json` **und** `en.json` (`t('bereich.feld')`, `{platzhalter}`). Nie nur eine Locale.
- **Timestamps:** `${NOW_ISO_SQL}` serverseitig, `tzOpts()`/`formatDate` für die Anzeige.
- **File-Limits:** JS >600 / Partial >250 / CSS >600 LOC → in `<name>/`-Subfolder mit Facade splitten.

## Tests

- **Unit** für die Facade (Muster: [tests/unit/note-store.test.js](tests/unit/note-store.test.js) — eigene Temp-DB via `DB_PATH` **vor** dem ersten `require`).
- **Integration** für die API (Muster: [tests/integration/notes-api.test.js](tests/integration/notes-api.test.js)).
- **E2E/Smoke**, sobald UI dazukommt — der Smoke-Test ist die einzige Schicht, die verschluckte Alpine-Template-Fehler sichtbar macht. Neue Nav-Einträge: erwartete Anzahl in [tests/smoke/app-boots.spec.js](tests/smoke/app-boots.spec.js) nachziehen.
- Abschluss: `npm run test:unit` + `npm run test:integration` grün; bei UI zusätzlich `npm run test:e2e` + `npm run test:smoke`.

## Abschluss

Knapp melden: welche Teile (A/B/C/Migration) umgesetzt, welche Dateien angelegt/geändert, welche Registry-/i18n-Einträge ergänzt, Testergebnis. Offene Punkte explizit nennen. **Nicht** committen (überlässt du dem User bzw. `/release`).
