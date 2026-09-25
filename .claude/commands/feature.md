---
description: Neues Feature nach dem CLAUDE.md-Rezept anlegen (Registry/i18n/Facade/Job/Migration/Karte/Tests)
argument-hint: "[Feature-Beschreibung]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run feature:new:*), Bash(npm run test:unit:*), Bash(npm run test:integration:*), Bash(npm run test:e2e:*), Bash(npm run test:smoke:*), Bash(npm run squash:check:*), Bash(npm run migrations:lock:*), Bash(git status:*), Bash(git diff:*)
---

Du legst ein neues Feature an: **$ARGUMENTS**

Arbeite die relevanten Schritte der CLAUDE.md-Sektion „Add a feature" ab. **Nicht blind alles** — zuerst den Scope klären, dann nur die zutreffenden Teile.

## 0. Scope klären (zuerst!)

Bestimme (bei Unklarheit **nachfragen**, nicht raten):
- **Neue Domäne / neue Daten?** → Teil A (DB-Modul + Facade + Routes).
- **Schema-Änderung?** → erst `/migration` ausführen (oder dessen Schritte), dann hier weiter.
- **Langläufer?** Alles, was einen Request spürbar blockieren würde (Import, Export, Batch, externer Call, später KI), läuft als Job (Harte Regel „Langläufer nur via Job-Queue"). → Teil B.
- **Eigene UI?** Ein **neuer Navigationseintrag** → Teil C (Generator). Nur eine **Karte in einem bestehenden Feature** → nicht hier, sondern `/karte`.

## Teil A — Backend (Daten)

1. Domänen-DB-Modul unter `db/<domäne>.js` (Muster: [db/notes.js](db/notes.js)) — prepared Statements, `${NOW_ISO_SQL}` ([db/now.js](db/now.js)) für jeden `*_at`-Wert, **nie** `datetime('now')`.
2. **Facade** unter `lib/<domäne>-store.js` (Muster: [lib/note-store.js](lib/note-store.js)): Validierung + Invarianten hier, nicht in der Route. Routes und Jobs importieren **nur die Facade** — kein Roh-SQL ausserhalb von `db/` (Harte Regel „Domänen-Facade").
3. Router unter `routes/<domäne>.js` (Muster: [routes/notes.js](routes/notes.js)), in [server.js](server.js) mounten.
4. **Logging-Context:** jede Route setzt `setContext({ entity: … })` ([lib/log-context.js](lib/log-context.js)) nach der ID-Validierung.

## Teil B — Backend (Job)

1. Job-Datei `routes/jobs/<typ>.js` (Muster: [routes/jobs/note-stats.js](routes/jobs/note-stats.js)) registriert ihren Runner; Typ in `KNOWN_TYPES` von [routes/jobs/index.js](routes/jobs/index.js) eintragen und dort `require`n.
2. Enqueue über `queue.createJob(type, entityId)` — Dedup ist eingebaut; kein zweiter paralleler Job für dieselbe Entity.
3. Statustexte/Labels als i18n-Keys (`job.xxx`), nicht als fertiger Text.
4. Den Log-Kontext `[job|…|entity|jobId]` setzt die Queue selbst (`runWithContext` in [routes/jobs/shared/queue.js](routes/jobs/shared/queue.js)) — im Runner nichts nachbauen, nur bei Bedarf per `setContext` ergänzen.

## Teil C — Frontend (neues Feature in der Navigation)

**Vor neuer UI: [DESIGN.md](DESIGN.md)-Pattern-Katalog prüfen** — wiederverwenden, nicht neu erfinden. Fehlt das Pattern: erst dort dokumentieren (Markup + CSS-Datei + Use-Case), dann bauen. Die Struktur eines Features ist **fest** (DESIGN.md → „Feature anatomy") und wird **generiert, nicht von Hand gebaut**:

1. **Generieren:**
   ```bash
   npm run feature:new -- <id> --label-de "…" --label-en "…" --icon <sprite-id>
   ```
   `<id>` kebab-case (Hash-Route + Dateistamm), das Icon muss im Sprite stehen (DESIGN.md → Icon system). Erst mit `--dry-run` den Plan zeigen lassen. Das legt an: Feature-Karte `public/js/cards/<id>-card.js`, Fachmodul `public/js/<id>/<id>-methods.js`, Partial `public/partials/<id>.html`, `public/css/entities/<id>.css`, Harness + Spec — und trägt ein: `FEATURES`, Karten-Inventar `register-cards.js`, `<link>` in index.html + allen Harnesses, DESIGN.md-Inventar, i18n `nav.<id>` / `<id>.title` / `<id>.empty` in **beiden** Locales.
2. **Fachlogik** ins Fachmodul (`<id>Methods`, `this` = die Karte): API-Calls über `api()`, reine Berechnungen als eigene Exporte (unit-testbar). **Jedes Feld, das dort zugewiesen wird, als Initialfeld in der Karte deklarieren** (Gate `architecture-tripwire`).
3. **Karte** (`cards/<id>-card.js`): State ergänzen, `setupCardLifecycle`-Konfiguration anpassen (`load`, `resetState`, `timerKeys`, ggf. `reloadOnReopen: false`). Root-Felder im Template über `$app.…`, im JS über `window.__app` — **nie** Feature-Daten in den Root.
4. **Partial** ausbauen: Wurzel bleibt `x-data="<id>Card"`; Listeneinträge als eigene Sub-Komponente (`<entity>ItemCard`, Muster [note-item-card.js](public/js/cards/note-item-card.js)), Rückmeldung per DOM-Event. > 250 LOC → Teil-Partials unter `partials/<id>/` per `data-partial`.
5. **Sub-Route** nötig (`#<id>/<sub>`)? Die Karte liest `$app.featureSub`, **validiert** ihn und besitzt den Fallback.
6. **CSS** nur in `css/entities/<id>.css` und nur die Abweichung vom Karten-Vokabular.
7. **`x-html` nur mit `escHtml()`-vorescaptem Content** ([public/js/utils.js](public/js/utils.js)).

## Querschnitt (immer)

- **i18n:** jeder neue sichtbare String sofort in `de.json` **und** `en.json` (`t('bereich.feld')`, `{platzhalter}`). Nie nur eine Locale.
- **Timestamps:** `${NOW_ISO_SQL}` serverseitig, `tzOpts()`/`formatDate` für die Anzeige.
- **File-Limits:** JS >600 / Partial >250 / CSS >600 LOC → in `<name>/`-Subfolder mit Facade splitten.

## Tests

- **Unit** für die Facade (Muster: [tests/unit/note-store.test.js](tests/unit/note-store.test.js) — eigene Temp-DB via `DB_PATH` **vor** dem ersten `require`) und für reine Funktionen des Fachmoduls.
- **Integration** für die API (Muster: [tests/integration/notes-api.test.js](tests/integration/notes-api.test.js), Bootstrap `_helpers/setup.js`).
- **Harness-Spec** `tests/e2e/<id>-card.spec.js` (vom Generator angelegt) ausbauen: die Mock-Routen der Karte in [tests/server.js](tests/server.js) ergänzen, Verhalten prüfen (Muster: [notes-card.spec.js](tests/e2e/notes-card.spec.js)).
- **Smoke:** [tests/e2e-app/smoke.spec.js](tests/e2e-app/smoke.spec.js) liest die Registry selbst — das neue Feature ist automatisch dabei (öffnen, Karte gemountet, Hash-Route, Deep-Link).
- Abschluss: `npm run test:unit` + `npm run test:integration` + `npm run test:e2e` + `npm run test:smoke` grün.

## Abschluss

Knapp melden: welche Teile (A/B/C/Migration) umgesetzt, welche Dateien angelegt/geändert, welche Registry-/i18n-Einträge ergänzt, Testergebnis. Offene Punkte explizit nennen. **Nicht** committen (überlässt du dem User bzw. `/release`).
