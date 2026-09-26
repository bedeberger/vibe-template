# DB-Regeln (`db/`)

Gilt zusätzlich zur Root-[CLAUDE.md](../CLAUDE.md). Mechanik (frisch vs.
Upgrade, Squash, Lock, Renumber, Rollback): [docs/migrations.md](../docs/migrations.md).
Neue Migration: `/migration`.

- **Eine Domäne pro Datei.** [connection.js](connection.js) (die eine Verbindung,
  `PRAGMA foreign_keys = ON`, verweigert die Repo-DB unter `NODE_ENV=test`),
  [now.js](now.js), [migrations.js](migrations.js) (Runner),
  [schema.js](schema.js) (Boot: Squash oder Kette), [squashed-schema/](squashed-schema/)
  (ein Segment pro Domäne), [migrations/](migrations/) (`000N_<name>.js`), dann
  ein Modul pro Domäne ([notes.js](notes.js)). Domänenmodule werden nur über
  ihre Facade in `lib/` erreicht — Routen und Jobs importieren nie `db/<domain>.js`.
- **Timestamps: ISO+Z.** Jede `*_at`-Spalte speichert ISO-8601 mit `Z`. Defaults
  `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`; in INSERT/UPDATE `${NOW_ISO_SQL}`
  interpolieren und die Spalte **explizit** aufführen (nicht auf den Default
  verlassen). Nie `datetime('now')`. **Warum:** es hat kein Z — der Browser
  parst es als Lokalzeit und zeigt die UTC-Uhrzeit unter dem App-Zeitzonen-Label.

## Relationale Integrität

- **Jede `*_id` ist ein echter FK** (`REFERENCES`); lose Ids sind verboten.
- **Jede FK-Spalte ist indiziert** (`CREATE INDEX idx_<table>_<col>`).
- **`ON DELETE` ist eine Entscheidung:** `CASCADE` für eigene/abgeleitete Zeilen
  (Caches, Aggregate, Kinder, die ohne ihren Parent unerreichbar sind), `SET NULL`
  für kuratierte Daten, die ihren Parent überleben sollen. **Nie `SET NULL` auf
  einer Spalte, die ein CHECK als gesetzt verlangt** — das Delete bricht dann auf
  jedem Pfad ab, der die Kette berührt, und zwar erst zur Löschzeit.
- **Keine Snapshot-Spalten** (`notebook_name` neben `notebook_id`): Anzeigewerte
  beim Lesen per JOIN ableiten. Ausnahme: ein Audit-Name in einem Löschprotokoll,
  dessen referenzierte Zeile hart gelöscht wird.
- **Sentinel-frei:** kein `x_id = 0` / `'__all__'` als Diskriminator. Stattdessen
  ein explizites `kind TEXT NOT NULL CHECK(kind IN (…))` + NULL-Refs + ein CHECK,
  der beides verknüpft.
- **Forward-only.** Eine Migration, die je deine Maschine verlassen hat, wird nie
  umnummeriert oder editiert (der Lock-Test schlägt fehl, und Prod würde in einer
  Crash-Loop landen). Vorwärts korrigieren mit einer neuen Migration.
- **Recreate-Pattern**, um einer bestehenden Tabelle einen FK hinzuzufügen
  (SQLite hat kein `ADD CONSTRAINT`): Waisen bereinigen → `xxx_new` mit finalen
  FKs + Indizes → `INSERT … SELECT` → `DROP` + `RENAME` → Indizes neu anlegen.
  `PRAGMA foreign_keys` ist innerhalb der Runner-Transaktion ein No-op: zuerst
  prüfen, wer per FK auf die Tabelle zeigt — ein `CASCADE`-Kind verliert beim
  `DROP TABLE` seine Zeilen.
