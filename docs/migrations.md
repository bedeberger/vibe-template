# Migrationen

Nummerierte Forward-only-Dateien in [db/migrations/](../db/migrations/)
(`000N_<name>.js`, exportieren `{ version, name, up(db) }`). Den Ablauf für eine
neue beschreibt der Befehl `/migration` ([.claude/commands/migration.md](../.claude/commands/migration.md)).

## Zwei Installationspfade, ein Schema

| DB-Zustand beim Boot | Was [db/schema.js](../db/schema.js) tut |
| --- | --- |
| frisch (kein `schema_version`) | führt das **Squash-Schema** ([db/squashed-schema/](../db/squashed-schema/)) in einem Durchgang aus, stempelt `SQUASHED_VERSION` |
| bestehend | spielt nur Migrationen mit `version > MAX(schema_version)` nach |

Jeder Schritt läuft in einer Transaktion, gefolgt von `PRAGMA foreign_key_check`
([db/migrations.js](../db/migrations.js)); ein hängender FK schlägt laut fehl.
Migrationen laufen bei jedem Serverstart — `npm run db:migrate` fährt denselben
Pfad eigenständig.

## Die Gates

| Gate | Fängt |
| --- | --- |
| [squash-drift.test.mjs](../tests/unit/squash-drift.test.mjs) (`npm run squash:check`) | Squash und Kette ergeben verschiedene Schemas; `SQUASHED_VERSION` ≠ höchste Migration |
| [migration-chain-boot.test.mjs](../tests/unit/migration-chain-boot.test.mjs) | Kette scheitert mit `foreign_keys = ON` (FK-Reihenfolge, fehlerhaftes CREATE) |
| [migration-lock.test.mjs](../tests/unit/migration-lock.test.mjs) + [db/migrations.lock.json](../db/migrations.lock.json) | eine eingefrorene Migration umnummeriert/umbenannt/umgeschrieben, eine neue auf oder unter der eingefrorenen Marke eingefügt, doppelte Nummern, eine nicht eingefrorene neue Migration |

Von den Frische-Ketten-Tests nicht gefangen: `ADD COLUMN … REFERENCES` mit einem
Nicht-NULL-Default auf einer **befüllten** Tabelle. Für eine solche Migration
einen Seed-basierten `tests/unit/migration-000N-<name>.test.mjs` schreiben.

## Der Lock

`npm run migrations:lock` friert die Kette ein: Version → sha256 der
whitespace-normalisierten `up()`-Quelle plus Name. Mit der Migration committen.
Der Lock-Diff darf immer nur Zeilen **hinzufügen** — eine geänderte Zeile heisst,
eine veröffentlichte Migration wurde bearbeitet, was eine Prod-DB, die die alte
Bedeutung schon angewendet hat, in eine Crash-Schleife schickt. (Noch nie
deployt? Dann ist Neu-Einfrieren legitim — den Diff bewusst prüfen.)

## Paralleles Arbeiten: Umnummerieren

Zwei Branches mit derselben Nummer kollidieren in git meist **nicht**
(`0007_a.js` neben `0007_b.js`); der Lock-Test meldet es. `npm run
migration:renumber` verschiebt nur **deine** Migrationen (die nicht in
`origin/main`) auf `max(origin/main) + 1`, schreibt ihr `version:`-Feld um,
erzeugt den Lock neu und erhöht `SQUASHED_VERSION`. Das Einfalten der DDL bleibt
manuell. `--dry-run`, `--ref <ref>`, `--no-fetch`.

## Deploy und Rollback

Der Deploy zählt ausstehende Migrationen auf einer Kopie der Live-DB
([scripts/pending-migrations.js](../scripts/pending-migrations.js)) und führt die
neue Kette gegen diese Kopie aus, bevor er irgendetwas anfasst. Bei einem
fehlgeschlagenen Deploy wird die DB **nur** aus dem Backup vor dem Deploy
wiederhergestellt, wenn diese Zahl nicht `0` war (`-1` = unbekannt gilt als
"gelaufen"). Details: [deployment.md](deployment.md).

## Tests und die Repo-DB

`npm run test:unit`/`test:integration` laufen mit `NODE_ENV=test`
([scripts/with-env.js](../scripts/with-env.js)). Darunter verweigert
[db/connection.js](../db/connection.js), irgendetwas ohne explizites `DB_PATH`
zu öffnen — jeder Test setzt seine eigene Temp-DB vor seinem ersten `require`.
