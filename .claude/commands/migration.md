---
description: Neue DB-Migration anlegen (nummerierte Datei + FK-Integrität + Squash-Fold + migrations:lock)
argument-hint: "[kurze Beschreibung der Schema-Änderung]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm run squash:check:*), Bash(npm run db:migrate:*), Bash(npm run migrations:lock:*), Bash(npm run migration:renumber:*), Bash(npm run test:unit:*), Bash(git status:*), Bash(git diff:*), Bash(git ls-tree:*)
---

Du legst eine neue DB-Migration an. Schema-Änderung laut User: **$ARGUMENTS**

Der Workflow folgt CLAUDE.md „Add a feature" §5 + der Harten Regel „Relationale Integrität". Migrationen sind **nummerierte, forward-only Dateien** unter [db/migrations/](db/migrations/) (`000N_<name>.js`, Export `{ version, name, up(db) }`).

## 1. Vorbereitung

1. `db/migrations/` auflisten. Höchste vorhandene Nummer → neue Migration ist **N = höchste + 1**. Eine deployte Nummer **nie** wiederverwenden oder umschreiben — prod steht schon auf dieser Version mit der ALTEN Bedeutung und crash-loopt beim Boot. `migration-lock.test` fängt das ab.
   > Arbeiten mehrere Personen parallel, kann die Nummer inzwischen vergeben sein — und der Rebase zeigt das **nicht** als Konflikt, wenn die Dateinamen verschieden sind. Nach dem Rebase (oder bei einem „Doppelte Migrations-Version"-Verstoss): `npm run migration:renumber` hebt die **eigene**, ungepushte Migration auf `max(origin/main)+1`, schreibt das `version:`-Feld mit, erneuert den Lock und zieht `SQUASHED_VERSION` nach. Danach nur noch den Fold prüfen.
2. Vor neuen Tabellen/Kanten eine bestehende Migration als Muster lesen ([0001_init.js](db/migrations/0001_init.js)) — FK-Konvention und ON-DELETE-Strategie nicht neu erfinden.
3. Wenn unklar, welche Tabellen/Spalten/FKs gemeint sind: **nachfragen, nicht raten.**

## 2. Migration schreiben (`db/migrations/000N_<name>.js`)

Pflicht-Invarianten:

- **Echte FKs** — jede `*_id`-Spalte mit `REFERENCES`; lose IDs sind verboten.
- **Index auf jede neue FK-Spalte.**
- **`ON DELETE` bewusst:** `CASCADE` für owned/abgeleitete Zeilen, `SET NULL` für kuratierte Daten.
- **Keine Snapshot-Spalten** — Display-Werte zur Lesezeit per JOIN.
- **Timestamps:** Defaults `strftime('%Y-%m-%dT%H:%M:%fZ','now')`, in INSERT/UPDATE `${NOW_ISO_SQL}` ([db/now.js](db/now.js)) — **nie** `datetime('now')`.
- **`foreign_key_check` hängt der Runner selbst an** — [db/migrations.js](db/migrations.js) fährt jede Migration in einer Transaktion und prüft danach `PRAGMA foreign_key_check`. Nicht selbst in die Migration schreiben.
- **Diskriminator statt Sentinel:** `kind TEXT NOT NULL CHECK(...)` + NULL-Refs, nicht `x_id = 0`.

**FK auf bestehende Tabelle nachrüsten?** SQLite kann kein `ALTER TABLE ADD CONSTRAINT` → Recreate-Pattern: Orphans bereinigen → `xxx_new` mit finalen FKs + Indexen → `INSERT … SELECT` → `DROP` / `RENAME` → Indexe neu.

> **`PRAGMA foreign_keys` ist in der Runner-Transaktion wirkungslos** — das „OFF … ON"-Rezept aus der SQLite-Doku greift hier **nicht**. Hängt eine Kind-Tabelle per `ON DELETE CASCADE` an der umgebauten Tabelle, löscht das `DROP TABLE` deren Zeilen implizit mit. Vorher prüfen, **wer per FK auf die Tabelle zeigt**; Kind-Zeilen in eine `TEMP TABLE` sichern, id-erhaltend umkopieren, danach zurückspielen.

> **`ADD COLUMN … REFERENCES` mit Non-NULL-Default** scheitert nur auf einer **befüllten** Tabelle — die Fresh-Chain-Tests sehen das nicht. Für so eine Migration einen seed-basierten Test `tests/unit/migration-000N-<name>.test.mjs` schreiben (Kette bis N-1, Zeilen einfügen, N anwenden).

## 3. Squashed-Schema folden (Pflicht)

Die DDL ins passende Segment unter [db/squashed-schema/](db/squashed-schema/) folden (`core.js` / `notes.js` / `jobs.js` …, zusammengefügt in `index.js`; neues Domänen-Segment → Datei anlegen und in `index.js` dort einreihen, wo seine FK-Ziele schon definiert sind) **und `SQUASHED_VERSION` in [db/squashed-schema/index.js](db/squashed-schema/index.js) auf N setzen**. Reine Daten-Migration (nur Zeilen): nichts folden, nur die Version bumpen + Kommentar in `index.js`.

> Die Segmente sind JS-Template-Literals — **keine Backticks** in SQL-Kommentaren.

Dann `npm run squash:check` (grün = squashed Schema == Migrationskette). Rot → nachbessern.

## 4. Migration einfrieren (Pflicht, selber Commit)

`npm run migrations:lock` und das aktualisierte [db/migrations.lock.json](db/migrations.lock.json) mitcommitten — append-only Register (Version → Fingerprint von `up()`). Der Diff darf **nur neue Einträge** zeigen; ändert sich ein bestehender, ist die forward-only-Regel verletzt.

## 5. Dev-Seed (sobald eine Tabelle dazukommt)

Eine neue Tabelle ohne Daten ist im UI nicht von einer kaputten Ansicht zu unterscheiden. [lib/dev-seed.js](lib/dev-seed.js) erweitern — über die **Facade** schreiben, hinter einem „ist leer"-Wächter, und die **Unterschiede** seeden statt fünf gleichartige Zeilen.

## 6. Verifizieren

- `npm run db:migrate` (optional — Kette lokal gegen die eigene app.db).
- `npm run test:unit` — deckt `squash-drift`, `migration-chain-boot` (Kette mit `foreign_keys = ON`) und `migration-lock` ab. Grün = fertig.

## Abschluss

Knapp melden: neue Version N, angelegte Tabelle(n)/Spalte(n)/FK(s), ON-DELETE-Wahl, Segment des Folds, ob `squash:check` grün, ob `migrations:lock` lief, welcher Seed-Schritt die neuen Tabellen füllt. Bei Fehlschlag eines Schritts **stoppen** und Stand berichten. **Nicht** committen (überlässt du dem User bzw. `/release`).
